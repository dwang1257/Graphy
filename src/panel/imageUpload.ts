export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;

interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageUploadPlatform {
  decode: (file: Blob) => Promise<ImageDimensions>;
  readAsDataUrl: (file: Blob) => Promise<string>;
}

const uploadError = "Graphy could not read that image. Try another image file.";

const browserPlatform: ImageUploadPlatform = {
  async decode(file): Promise<ImageDimensions> {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  },
  readAsDataUrl(file): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error(uploadError));
        }
      };
      reader.onerror = () => reject(new Error(uploadError));
      reader.onabort = () => reject(new Error(uploadError));
      reader.readAsDataURL(file);
    });
  },
};

export async function readImageDataUrl(
  file: Pick<File, "size" | "type">,
  platform: ImageUploadPlatform = browserPlatform,
): Promise<string> {
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 4 MB or smaller.");
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await platform.decode(file as Blob);
  } catch {
    throw new Error(uploadError);
  }
  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    throw new Error("Image dimensions must be 4096 × 4096 pixels or smaller.");
  }

  try {
    return await platform.readAsDataUrl(file as Blob);
  } catch {
    throw new Error(uploadError);
  }
}
