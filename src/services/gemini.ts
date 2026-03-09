import { GoogleGenAI } from "@google/genai";

export interface GenerationResult {
  imageUrl: string;
  prompt: string;
}

export interface BrandAnalysis {
  tagline: string;
  personality: string[];
  typography: {
    primary: string;
    secondary: string;
    description: string;
  };
}

export async function generateBranding(
  base64Image: string,
  mimeType: string,
  type: 'icon' | 'variation' | 'business-card' | 'social-banner' | 'letterhead' | 'instagram' | 'twitter' | 'linkedin' | 'website-mockup',
  customPrompt?: string
): Promise<GenerationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

  const defaultPrompts = {
    icon: "Simplify this logo into a clean, minimalist, ultra-high-quality app icon. Focus on the central 'A' symbol and the tech-circuit aesthetic. Solid background, professional finish, 4k detail.",
    variation: "Create a modern, high-end 4k variation of this logo. Keep the 'A' and 'Aothothe' theme but explore a different futuristic or minimalist style. High resolution, professional branding.",
    'business-card': "Design a professional, modern business card mockup using this logo. Show both front and back. Minimalist, elegant, high-end corporate feel, photorealistic 4k.",
    'social-banner': "Create a high-quality social media banner (LinkedIn/Twitter style) using this logo and branding. Professional, tech-focused, clean layout, 4k resolution.",
    letterhead: "Design a professional corporate letterhead mockup using this logo. Clean, minimalist, showing the logo in the header and professional footer details, high resolution.",
    instagram: "Create a vibrant, high-quality Instagram profile icon using this logo. Modern, clean, optimized for circular display, 4k detail.",
    twitter: "Create a professional Twitter profile icon using this logo. Clean, tech-focused, optimized for circular display, 4k detail.",
    linkedin: "Create a professional, corporate LinkedIn profile icon using this logo. High-end, clean, optimized for circular display, 4k detail.",
    'website-mockup': "Design a high-end, modern SaaS website landing page mockup using this logo and branding. Show a hero section with clean typography, a call-to-action button, and a professional layout. 4k resolution, photorealistic web design."
  };

  const finalPrompt = customPrompt || defaultPrompts[type];

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Image.split(',')[1] || base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: finalPrompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    }
  });

  let imageUrl = "";
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!imageUrl) {
    throw new Error("Failed to generate image");
  }

  return {
    imageUrl,
    prompt: finalPrompt
  };
}

export async function analyzeBrand(
  base64Image: string,
  mimeType: string
): Promise<BrandAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Analyze this logo and provide: 1. A catchy tagline. 2. Three brand personality traits. 3. Suggested Google Font pairings (Primary and Secondary) with a brief explanation of why they fit. Return as a JSON object with keys: tagline (string), personality (array of strings), typography (object with keys: primary, secondary, description).",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text) as BrandAnalysis;
  } catch (e) {
    console.error("Failed to parse brand analysis", e);
    return {
      tagline: "Your Vision, Realized.",
      personality: ["Modern", "Professional", "Innovative"],
      typography: {
        primary: "Inter",
        secondary: "Space Grotesk",
        description: "A clean, modern pairing that emphasizes clarity and technical precision."
      }
    };
  }
}

export async function extractPalette(
  base64Image: string,
  mimeType: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Extract the 5 most dominant hex color codes from this logo. Return only a JSON array of strings, e.g., [\"#FFFFFF\", \"#000000\"].",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    const colors = JSON.parse(response.text);
    return Array.isArray(colors) ? colors : [];
  } catch (e) {
    console.error("Failed to parse palette", e);
    return [];
  }
}
