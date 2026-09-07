const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const settingsBtn = document.getElementById('settings-btn');
const settingsDropdown = document.getElementById('settings-dropdown');
const clearBtn = document.getElementById('clear-btn');
const attachBtn = document.getElementById('attach-btn');
const chipButtons = document.querySelectorAll('.chip-btn');
const fileInput = document.getElementById('file-input');
const attachPreview = document.getElementById('attachment-preview');
const previewThumbWrapper = document.getElementById('preview-thumb-wrapper');
const previewFilename = document.getElementById('preview-filename');
const previewFilesize = document.getElementById('preview-filesize');
const removeAttachBtn = document.getElementById('remove-attach-btn');

let currentAttachment = null;

// Backend API URL (supports port 3000, Live Server 5500, or file)
const API_URL = (window.location.origin && window.location.origin.includes(':3000'))
  ? '/api/chat'
  : 'http://localhost:3000/api/chat';

// LocalStorage key for saving chat sessions
const STORAGE_KEY = 'chat_sessions';

// In-memory conversation state: Array of { role: 'user' | 'model', text: string, time?: string }
let conversations = [];

// Helper: Format current time as HH:mm
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Render Markdown safely into HTML
function formatMarkdown(text) {
  if (typeof text !== 'string') return '';
  // Remove horizontal divider lines (---, ***, ___) from AI responses
  const cleanText = text.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '').replace(/\n{3,}/g, '\n\n');

  if (window.marked) {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      const rawHtml = marked.parse(cleanText);
      return window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return cleanText;
    }
  }
  return cleanText;
}

// Bot Sprout Avatar SVG string
const SPROUT_AVATAR_HTML = `
  <div class="bot-avatar">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22V12" stroke="#2d6240" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 12C12 7.02944 16.0294 3 21 3C21 7.97056 16.9706 12 12 12Z" fill="#38714b" stroke="#2d6240" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 15C12 11.134 8.86599 8 5 8C5 11.866 8.13401 15 12 15Z" fill="#8bc19d" stroke="#2d6240" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  </div>
`;

// Double checkmark SVG for user timestamp
const DOUBLE_CHECK_SVG = `
  <svg class="check-icon" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 10l3 3 8-8"></path>
    <path d="M8 10l3 3 8-8" opacity="0.6"></path>
  </svg>
`;

// Append message element to the chat box
function appendMessage(sender, text, shouldScroll = true, time = null, file = null) {
  const messageTime = time || getCurrentTime();
  const row = document.createElement('div');
  row.classList.add('message-row', sender);

  const bubble = document.createElement('div');
  bubble.classList.add('message-bubble', sender);

  if (sender === 'bot') {
    row.innerHTML = SPROUT_AVATAR_HTML;

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = formatMarkdown(text);
    bubble.appendChild(contentDiv);

    const timeDiv = document.createElement('div');
    timeDiv.classList.add('msg-time');
    timeDiv.textContent = messageTime;
    bubble.appendChild(timeDiv);

    row.appendChild(bubble);
  } else {
    // Render attachment if present in user message
    if (file) {
      const attachContainer = document.createElement('div');
      attachContainer.classList.add('user-attachment-container');

      const isImage = file.isImage || (file.mimeType && file.mimeType.startsWith('image/'));
      if (isImage) {
        const img = document.createElement('img');
        img.src = file.dataUrl || (file.data ? `data:${file.mimeType};base64,${file.data}` : '');
        img.alt = file.name || 'Lampiran Gambar';
        img.classList.add('user-attachment-img');
        img.title = 'Klik untuk membuka gambar ukuran penuh';
        img.addEventListener('click', () => {
          window.open(img.src, '_blank');
        });
        attachContainer.appendChild(img);
      } else {
        const docCard = document.createElement('div');
        docCard.classList.add('user-attachment-doc');
        const isPdf = (file.mimeType === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf')));
        docCard.innerHTML = `
          <span class="doc-icon">${isPdf ? '📄' : '📝'}</span>
          <div class="doc-details">
            <span class="doc-name" title="${file.name}">${file.name}</span>
            ${file.sizeText ? `<span class="doc-size">${file.sizeText}</span>` : ''}
          </div>
        `;
        attachContainer.appendChild(docCard);
      }

      bubble.appendChild(attachContainer);
    }

    if (text) {
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      bubble.appendChild(textSpan);
    }

    const timeDiv = document.createElement('div');
    timeDiv.classList.add('msg-time');
    timeDiv.innerHTML = `${messageTime} ${DOUBLE_CHECK_SVG}`;
    bubble.appendChild(timeDiv);

    row.appendChild(bubble);
  }

  chatBox.appendChild(row);

  if (shouldScroll) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  return { row, bubble };
}

// Show the default Welcome Card with interactive Mood Chips (from the reference design)
function showWelcomeMessage() {
  const welcomeText = `Hai! 👋
Aku MindFlow AI. Senang banget bisa di sini untuk membantu kamu lebih produktif dan tetap menjaga kesehatan mental serta keseimbangan hidup.

Bagaimana perasaanmu hari ini?`;

  const { bubble } = appendMessage('bot', welcomeText, false, '09:24');

  // Inject the interactive mood chips
  const moodContainer = document.createElement('div');
  moodContainer.classList.add('mood-grid');
  moodContainer.innerHTML = `
    <button type="button" class="mood-chip good" data-mood="Baik">
      <span>😃</span> Baik
    </button>
    <button type="button" class="mood-chip neutral" data-mood="Biasa saja">
      <span>😐</span> Biasa saja
    </button>
    <button type="button" class="mood-chip stressed" data-mood="Sedikit stres">
      <span>😡</span> Sedikit stres
    </button>
    <button type="button" class="mood-chip tired" data-mood="Sangat lelah">
      <span>😫</span> Sangat lelah
    </button>
  `;

  // Attach event listeners to mood buttons
  moodContainer.querySelectorAll('.mood-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.getAttribute('data-mood');
      handleUserSubmit(`Hari ini aku merasa ${mood}.`);
    });
  });

  // Insert mood container right before the timestamp
  const timeDiv = bubble.querySelector('.msg-time');
  if (timeDiv) {
    bubble.insertBefore(moodContainer, timeDiv);
  } else {
    bubble.appendChild(moodContainer);
  }
}

// Load chat history from LocalStorage when the page loads
function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      conversations = JSON.parse(saved);
      if (Array.isArray(conversations) && conversations.length > 0) {
        conversations.forEach(({ role, text, time, file }) => {
          const senderClass = (role === 'model' || role === 'bot') ? 'bot' : 'user';
          appendMessage(senderClass, text, false, time, file);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        return;
      }
    }
  } catch (error) {
    console.error('Failed to load chat history from localStorage:', error);
    conversations = [];
  }

  // If no previous chat, show the welcome card
  showWelcomeMessage();
}

// Save conversation state to LocalStorage
function saveChatHistory() {
  try {
    const storable = conversations.map(c => {
      if (c.file) {
        return {
          role: c.role,
          text: c.text,
          time: c.time,
          file: {
            name: c.file.name,
            mimeType: c.file.mimeType,
            sizeText: c.file.sizeText,
            isImage: c.file.isImage,
            dataUrl: (c.file.dataUrl && c.file.dataUrl.length < 150000) ? c.file.dataUrl : undefined
          }
        };
      }
      return c;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storable));
  } catch (error) {
    console.warn('Failed to save chat history to localStorage:', error);
  }
}

// Helper: Format file size in B, KB, or MB
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Clear currently selected attachment
function clearAttachment() {
  currentAttachment = null;
  if (fileInput) fileInput.value = '';
  if (attachPreview) attachPreview.classList.add('hidden');
  if (previewThumbWrapper) previewThumbWrapper.innerHTML = '';
}

// File Attachment Event Listeners
if (attachBtn && fileInput) {
  attachBtn.addEventListener('click', () => {
    fileInput.click();
  });
}

if (removeAttachBtn) {
  removeAttachBtn.addEventListener('click', clearAttachment);
}

if (fileInput) {
  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    // Limit to 15MB file size
    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file terlalu besar! Maksimal ukuran file adalah 15MB.');
      fileInput.value = '';
      return;
    }

    const isImage = file.type.startsWith('image/');
    const sizeText = formatFileSize(file.size);

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const base64Data = dataUrl.split(',')[1];

      let mimeType = file.type;
      if (!mimeType) {
        if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        else if (file.name.toLowerCase().endsWith('.csv')) mimeType = 'text/csv';
        else if (file.name.toLowerCase().endsWith('.md')) mimeType = 'text/markdown';
        else mimeType = 'text/plain';
      }

      currentAttachment = {
        name: file.name,
        mimeType: mimeType,
        sizeText: sizeText,
        isImage: isImage,
        data: base64Data,
        dataUrl: dataUrl
      };

      // Show preview bar
      previewFilename.textContent = file.name;
      previewFilesize.textContent = sizeText;
      previewThumbWrapper.innerHTML = '';

      if (isImage) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.classList.add('preview-thumb-img');
        previewThumbWrapper.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.classList.add('preview-doc-icon');
        icon.textContent = (mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) ? '📄' : '📝';
        previewThumbWrapper.appendChild(icon);
      }

      if (attachPreview) {
        attachPreview.classList.remove('hidden');
      }
      input.focus();
    };

    reader.readAsDataURL(file);
  });
}

// Send a user prompt to the backend
async function handleUserSubmit(messageText) {
  const userMessage = (messageText !== undefined ? messageText : input.value).trim();
  const attachmentToSend = currentAttachment;

  // Don't send if both text and attachment are empty
  if (!userMessage && !attachmentToSend) return;

  const displayMessage = userMessage || (attachmentToSend ? `Tolong analisis ${attachmentToSend.isImage ? 'gambar' : 'dokumen'} "${attachmentToSend.name}" ini.` : '');
  const msgTime = getCurrentTime();

  // 1. Append user message with attachment to UI
  appendMessage('user', displayMessage, true, msgTime, attachmentToSend);
  input.value = '';
  clearAttachment();

  // 2. Save user message to conversations state and localStorage
  conversations.push({
    role: 'user',
    text: displayMessage,
    time: msgTime,
    file: attachmentToSend ? {
      name: attachmentToSend.name,
      mimeType: attachmentToSend.mimeType,
      sizeText: attachmentToSend.sizeText,
      isImage: attachmentToSend.isImage,
      data: attachmentToSend.data,
      dataUrl: attachmentToSend.dataUrl
    } : undefined
  });
  saveChatHistory();

  // 3. Disable controls while waiting
  const submitButton = document.getElementById('send-btn');
  if (submitButton) submitButton.disabled = true;
  input.disabled = true;

  // 4. Show thinking indicator
  const { bubble: thinkingBubble } = appendMessage('bot', 'MindFlow AI sedang menganalisis pesan...', true);

  try {
    // 5. Send conversation history to backend /api/chat
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversations: conversations.map(({ role, text, file }) => ({
          role: (role === 'model' || role === 'bot') ? 'model' : 'user',
          text,
          file: file ? {
            name: file.name,
            mimeType: file.mimeType,
            data: file.data
          } : undefined
        }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    const botReply = data.result || 'Tidak ada balasan dari server.';
    const replyTime = getCurrentTime();

    // 6. Update thinking message with bot's rendered response
    const contentDiv = thinkingBubble.querySelector('.message-content') || thinkingBubble;
    contentDiv.innerHTML = formatMarkdown(botReply);

    const timeDiv = thinkingBubble.querySelector('.msg-time');
    if (timeDiv) timeDiv.textContent = replyTime;

    chatBox.scrollTop = chatBox.scrollHeight;

    // 7. Save bot response to state and localStorage
    conversations.push({ role: 'model', text: botReply, time: replyTime });
    saveChatHistory();

  } catch (error) {
    console.error('Error fetching chat response:', error);
    // Pop failed user message so turns continue to alternate properly
    conversations.pop();
    saveChatHistory();

    const contentDiv = thinkingBubble.querySelector('.message-content') || thinkingBubble;
    contentDiv.textContent = 'Oops! Gagal mendapatkan respon dari server. Pastikan backend aktif di port 3000.';
    thinkingBubble.style.backgroundColor = '#fdeae8';
    thinkingBubble.style.color = '#942f28';
  } finally {
    // 8. Re-enable form controls
    if (submitButton) submitButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// Form submission handler
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleUserSubmit();
  });
}

// Quick suggestion chip buttons
chipButtons.forEach(btn => {
  btn.addEventListener('click', function () {
    const prompt = this.getAttribute('data-prompt');
    if (prompt) {
      handleUserSubmit(prompt);
    }
  });
});

// Settings gear button & dropdown toggle
if (settingsBtn && settingsDropdown) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
      settingsDropdown.classList.add('hidden');
    }
  });
}

// Clear chat history button
if (clearBtn) {
  clearBtn.addEventListener('click', function () {
    if (confirm('Yakin ingin menghapus seluruh riwayat percakapan?')) {
      localStorage.removeItem(STORAGE_KEY);
      conversations = [];
      chatBox.innerHTML = '';
      showWelcomeMessage();
      if (settingsDropdown) settingsDropdown.classList.add('hidden');
    }
  });
}

// Initialize on page load
loadChatHistory();
