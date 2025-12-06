import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PhotoMetadata } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A concise, catchy title for the image, suitable for stock photography.",
    },
    description: {
      type: Type.STRING,
      description: "A detailed description of the image visual content, action, and mood (1-2 sentences).",
    },
    category: {
      type: Type.STRING,
      description: "Classify the image into exactly ONE of these categories: Backgrounds, Textures, Patterns, Nature, People, Business, Technology, Food, Interiors, Architecture, Abstract, Animals, Travel, Illustrations.",
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of 25-30 relevant keywords and tags for SEO and discoverability.",
    },
    qualityAnalysis: {
      type: Type.OBJECT,
      properties: {
        score: {
          type: Type.NUMBER,
          description: "A quality score from 1 (terrible/obvious AI errors) to 10 (perfect realism/no errors). Penalize heavily for anatomical or physics errors.",
        },
        issues: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "A list of specific flaws found based on the audit criteria (Anatomy, Text, Lighting, Physics, Context, Textures). Format strings as 'Category: Issue found' (e.g., 'Anatomy: Extra finger on left hand', 'Physics: Shadow missing under chair'). Return empty list if perfect.",
        }
      },
      required: ["score", "issues"],
    }
  },
  required: ["title", "description", "category", "keywords", "qualityAnalysis"],
};

export const generateImageMetadata = async (
  base64Data: string, 
  mimeType: string
): Promise<PhotoMetadata> => {
  try {
    const model = "gemini-2.5-flash"; // Using 2.5 flash for speed and multimodal capabilities
    
    const analysisCriteria = `
    Analyze this image for stock photography usage and perform a RIGOROUS technical audit for AI-generation artifacts.
    
    1. Generate Metadata: Title, Description, Category, Keywords.
    
    2. Quality Audit: Scrutinize the image for the following specific errors. If found, list them in the 'issues' array:
       - Anatomical Inaccuracies: Extra/missing fingers, warped hands, misaligned eyes/teeth, irregular limbs.
       - Garbled Text: Nonsensical characters, gibberish signs, misspellings in visible text.
       - Lighting/Shadows: Inconsistent light sources, missing shadows, illogical highlighting.
       - Physics/Perspective: Floating objects, gravity violations, warped perspective, melting backgrounds.
       - Context/Logic: Illogical situations (e.g., rain indoors), objects blending into each other.
       - Textures: Repetitive hair/skin patterns, overly smooth 'plastic' skin, distorted fabrics.
       - Inconsistent Details: Asymmetrical architecture, mismatched clothing details, weird blending.
    
    If the image looks real and high quality, give a high score (8-10). If it has these specific artifacts, lower the score significantly (1-6) and list every issue found.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: analysisCriteria,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: metadataSchema,
        temperature: 0.2, // Low temperature for critical analysis
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini.");
    }

    return JSON.parse(text) as PhotoMetadata;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1]; 
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};