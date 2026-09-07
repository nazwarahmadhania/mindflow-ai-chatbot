import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const upload = multer();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-3.5-flash-lite";

app.use(express.json());

const PORT = 3000;

app.get('/', (req, res) => {
    res.send('ashhh!')
})

app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });

        res.status(200).json({ result: response.text });

    } catch (error) {
        console.error("Error generating text:", error);
        res
            .status(500)
            .json({
                error:
                    "Something went wrong while generating text."
            });

    }
});

app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const { prompt } = req.body;
    const base64image = req.file.buffer.toString("base64");

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { text: prompt, type: "text" },
                { inlineData: { data: base64image, mimeType: req.file.mimetype } }
            ]
        });

        res.status(200).json({ result: response.text });

    } catch (error) {
        console.error("Error generating image:", error);
        res
            .status(500)
            .json({
                error:
                    "Something went wrong while generating image."
            });

    }
});

app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
