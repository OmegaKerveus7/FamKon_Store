import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanner({ onDetected }: { onDetected: (text: string) => void }) {
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          scanner.stop().catch(() => {});
          onDetectedRef.current(text);
        },
        () => {},
      )
      .catch(() => {});
    return () => {
      scanner.stop().catch(() => {});
      scanner.clear();
    };
  }, []);

  return <div id="qr-reader" className="min-h-[280px] w-full" />;
}