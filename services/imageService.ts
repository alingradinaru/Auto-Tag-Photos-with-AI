import { PhotoItem } from "../types";
import { fileToBase64 } from "./geminiService";

// Declare global types for the libraries loaded via script tags
declare global {
  interface Window {
    piexif: any;
    JSZip: any;
  }
}

// Helper to convert string to UCS-2 (UTF-16 LE) byte array for Windows XP Tags
const toUCS2 = (str: string): number[] => {
  const res: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    res.push(code & 0xff);
    res.push((code >> 8) & 0xff);
  }
  // Add null terminator (2 bytes)
  res.push(0, 0);
  return res;
};

// Helper to construct filename with category suffix
const constructFileName = (photo: PhotoItem, keepOriginal: boolean): string => {
  if (!photo.data) return photo.file.name;

  const extension = photo.file.name.split('.').pop() || 'jpg';
  const categorySuffix = photo.data.category ? `(${photo.data.category})` : '';

  let baseName;
  if (keepOriginal) {
    const lastDotIndex = photo.file.name.lastIndexOf('.');
    baseName = lastDotIndex !== -1 ? photo.file.name.substring(0, lastDotIndex) : photo.file.name;
  } else {
    // Sanitize title for filename
    baseName = photo.data.title
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 50);
  }

  return `${baseName}${categorySuffix}.${extension}`;
};

export const embedMetadata = async (
  base64Data: string, 
  title: string, 
  description: string, 
  keywords: string[],
  category?: string
): Promise<string> => {
  try {
    // Check if piexif is loaded
    if (!window.piexif) {
      console.error("piexif library not loaded");
      return base64Data;
    }
    
    const piexif = window.piexif;

    // 0th IFD (Image File Directory)
    // ImageDescription - 0x010E (Standard)
    // XPTitle - 0x9C9B (Windows)
    // XPComment - 0x9C9C (Windows - often used for description)
    // XPKeywords - 0x9C9D (Windows)
    
    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    // Access ImageIFD constants from the loaded module
    const ImageIFD = piexif.ImageIFD;

    // Append category to keywords for embedding if it exists
    const finalKeywords = category ? [...keywords, category] : keywords;

    const exifObj = {
      "0th": {
        [ImageIFD.ImageDescription]: description,
        [ImageIFD.XPTitle]: toUCS2(title),
        [ImageIFD.XPComment]: toUCS2(description),
        [ImageIFD.XPKeywords]: toUCS2(finalKeywords.join(';')),
        [ImageIFD.Software]: "InstaTag AI"
      },
      "Exif": {},
      "GPS": {},
      "1st": {},
      "thumbnail": null
    };

    const exifBytes = piexif.dump(exifObj);
    const newBase64 = piexif.insert(exifBytes, "data:image/jpeg;base64," + cleanBase64);
    
    // Return just the base64 data part
    return newBase64.split(',')[1];
  } catch (error) {
    console.error("Error embedding metadata:", error);
    // If embedding fails (e.g. not a JPEG), return original
    return base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  }
};

export const createZipWithMetadata = async (
  photos: PhotoItem[], 
  keepOriginalFilenames: boolean
): Promise<Blob> => {
  // Check if JSZip is loaded
  if (!window.JSZip) {
    throw new Error("JSZip library not loaded");
  }

  const JSZip = window.JSZip;
  const zip = new JSZip();
  const folder = zip.folder("instatag_photos");

  for (const photo of photos) {
    if (photo.data) {
      // Get fresh base64
      let base64 = await fileToBase64(photo.file);
      
      // If it's a JPEG, embed metadata
      if (photo.file.type === 'image/jpeg' || photo.file.type === 'image/jpg') {
        base64 = await embedMetadata(
          base64, 
          photo.data.title, 
          photo.data.description, 
          photo.data.keywords,
          photo.data.category
        );
      } else {
        console.warn(`Skipping metadata embedding for non-JPEG file: ${photo.file.name}`);
      }

      const fileName = constructFileName(photo, keepOriginalFilenames);
      folder?.file(fileName, base64, { base64: true });
    }
  }

  return await zip.generateAsync({ type: "blob" });
};

export const processAndDownloadSingleImage = async (
  photo: PhotoItem, 
  keepOriginalFilenames: boolean
): Promise<void> => {
  if (!photo.data) return;

  let base64 = await fileToBase64(photo.file);
  
  // If it's a JPEG, embed metadata
  if (photo.file.type === 'image/jpeg' || photo.file.type === 'image/jpg') {
    base64 = await embedMetadata(
      base64, 
      photo.data.title, 
      photo.data.description, 
      photo.data.keywords,
      photo.data.category
    );
  }

  const fileName = constructFileName(photo, keepOriginalFilenames);

  const link = document.createElement('a');
  link.href = `data:${photo.file.type};base64,${base64}`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const upscaleImage = (file: File, scale: number, customWidth?: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width, height;
      
      if (customWidth) {
        width = Math.round(customWidth);
        height = Math.round((img.height / img.width) * customWidth);
      } else {
        width = Math.round(img.width * scale);
        height = Math.round(img.height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High quality scaling settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
             const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
             resolve(newFile);
          } else {
             reject(new Error("Canvas to Blob failed"));
          }
        }, file.type, 0.92); // 92% quality for standard output
      } else {
        reject(new Error("Canvas context failed"));
      }
    };
    
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    
    img.src = objectUrl;
  });
};