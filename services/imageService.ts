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

// Helper for UserComment (ASCII with prefix)
const toUserComment = (str: string): number[] => {
    // "ASCII\0\0\0" header followed by string bytes
    const res = [65, 83, 67, 73, 73, 0, 0, 0]; 
    for (let i = 0; i < str.length; i++) {
        res.push(str.charCodeAt(i) & 0xFF);
    }
    return res;
};

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
};

const createXmpPacket = (title: string, description: string, keywords: string[], category?: string) => {
  const safeTitle = escapeXml(title);
  const safeDesc = escapeXml(description);
  const safeCategory = category ? escapeXml(category) : '';
  const keywordsXml = keywords.map(k => `<rdf:li>${escapeXml(k)}</rdf:li>`).join('');

  // Minimal XMP Packet with Dublin Core schema
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140 79.160451, 2017/05/06-01:08:21        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${safeTitle}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${safeDesc}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
     ${keywordsXml}
    </rdf:Bag>
   </dc:subject>
   ${safeCategory ? `<photoshop:Category>${safeCategory}</photoshop:Category>` : ''}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;
};

// Function to inject APP1 XMP segment into JPEG binary string
const insertXmp = (binaryStr: string, xmpXml: string): string => {
    const xmpHeader = "http://ns.adobe.com/xap/1.0/\0";
    const xmpPayload = xmpHeader + xmpXml;
    
    // Construct segment: FF E1 + Length (2 bytes) + Payload
    const length = 2 + xmpPayload.length;
    const lengthBytes = String.fromCharCode((length >> 8) & 0xFF, length & 0xFF);
    const segment = "\xFF\xE1" + lengthBytes + xmpPayload;

    // Find insertion point (After SOI, and preferably after existing APP0/APP1)
    // Simple approach: Scan for SOI (FF D8) and skip recognized headers (FF E0, FF E1)
    let offset = 2; // Start after FF D8
    
    while (offset < binaryStr.length) {
        if (binaryStr.charCodeAt(offset) === 0xFF) {
            const marker = binaryStr.charCodeAt(offset + 1);
            // Skip JFIF (E0) and Exif (E1) to insert XMP after them
            if (marker === 0xE0 || marker === 0xE1) {
                const len1 = binaryStr.charCodeAt(offset + 2);
                const len2 = binaryStr.charCodeAt(offset + 3);
                const len = (len1 << 8) | len2;
                offset += 2 + len;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    
    return binaryStr.slice(0, offset) + segment + binaryStr.slice(offset);
};

// Helper to construct filename with category suffix
export const constructFileName = (photo: PhotoItem, keepOriginal: boolean): string => {
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
    const ImageIFD = piexif.ImageIFD;
    const ExifIFD = piexif.ExifIFD;

    // Clean base64 string
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // Append category to keywords for embedding if it exists
    const finalKeywords = category ? [...keywords, category] : keywords;

    // 1. Prepare EXIF Data
    const exifObj = {
      "0th": {
        [ImageIFD.ImageDescription]: description, // Standard Description
        [ImageIFD.XPTitle]: toUCS2(title),        // Windows Title
        [ImageIFD.XPComment]: toUCS2(description), // Windows Comment
        [ImageIFD.XPKeywords]: toUCS2(finalKeywords.join(';')), // Windows Tags
        [0x9C9F]: toUCS2(description),            // Windows Subject
        [ImageIFD.Software]: "Photagg AI"
      },
      "Exif": {
        [ExifIFD.UserComment]: toUserComment(description) // Standard Exif Comment
      },
      "GPS": {},
      "1st": {},
      "thumbnail": null
    };

    // 2. Insert EXIF
    const exifBytes = piexif.dump(exifObj);
    const exifModifiedBase64 = piexif.insert(exifBytes, "data:image/jpeg;base64," + cleanBase64);
    
    // 3. Insert XMP
    // We need to work with the binary string of the Exif-modified file
    const binaryStr = atob(exifModifiedBase64.split(',')[1]);
    const xmpXml = createXmpPacket(title, description, finalKeywords, category);
    const finalBinary = insertXmp(binaryStr, xmpXml);
    
    // Return just the base64 data part
    return btoa(finalBinary);

  } catch (error) {
    console.error("Error embedding metadata:", error);
    return base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  }
};

export const createZipWithMetadata = async (
  photos: PhotoItem[], 
  keepOriginalFilenames: boolean
): Promise<Blob> => {
  if (!window.JSZip) {
    throw new Error("JSZip library not loaded");
  }

  const JSZip = window.JSZip;
  const zip = new JSZip();
  const folder = zip.folder("photagg_photos");

  for (const photo of photos) {
    if (photo.data) {
      let base64 = await fileToBase64(photo.file);
      
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
        }, file.type, 0.92);
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
