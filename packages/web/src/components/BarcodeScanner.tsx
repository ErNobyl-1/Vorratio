import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RotateCcw } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

export default function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Check for BarcodeDetector API support
  const hasBarcodeDetector = 'BarcodeDetector' in window;

  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
        startScanning();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setHasCamera(false);
      onError?.('Unable to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsActive(false);
  };

  const toggleCamera = () => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  useEffect(() => {
    if (isActive) {
      stopCamera();
      startCamera();
    }
  }, [facingMode]);

  const startScanning = () => {
    if (!hasBarcodeDetector) {
      console.log('BarcodeDetector not supported, using fallback');
      return;
    }

    // @ts-ignore - BarcodeDetector is not in TypeScript types yet
    const barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    });

    scanIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes.length > 0) {
          const barcode = barcodes[0].rawValue;
          if (barcode) {
            // Stop scanning once we find a barcode
            stopCamera();
            onScan(barcode);
          }
        }
      } catch (err) {
        // Ignore detection errors
      }
    }, 200); // Scan every 200ms
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!hasCamera) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
          <CameraOff size={40} className="text-red-400" />
        </div>
        <p className="text-gray-600 mb-2">Camera not available</p>
        <p className="text-sm text-gray-400">
          Please grant camera permission or use manual entry below.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Video container */}
      <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${isActive ? '' : 'hidden'}`}
          playsInline
          muted
        />

        {/* Scanning overlay */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-primary-500 rounded-lg relative">
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary-500 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary-500 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary-500 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary-500 rounded-br" />
              {/* Scanning line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-primary-500 animate-scan" />
            </div>
          </div>
        )}

        {/* Placeholder when not active */}
        {!isActive && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <Camera size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Tap to start scanning</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for barcode detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex justify-center gap-4 mt-4">
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${
            isActive
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
          }`}
        >
          {isActive ? <CameraOff size={24} /> : <Camera size={24} />}
        </button>

        {isActive && (
          <button
            onClick={switchCamera}
            className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <RotateCcw size={24} />
          </button>
        )}
      </div>

      {/* Browser support warning */}
      {!hasBarcodeDetector && isActive && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Your browser doesn't support automatic barcode detection.
          Please enter the barcode manually.
        </div>
      )}
    </div>
  );
}
