import { renderShareImage, shareImageAlt, shareImageSize } from "@/components/marketing/ShareImage";

export const alt = shareImageAlt;
export const size = shareImageSize;
export const contentType = "image/png";

export default function Image() {
  return renderShareImage();
}
