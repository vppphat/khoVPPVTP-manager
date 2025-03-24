/**
 * Barcode Scanner Module
 * Handles the camera integration and barcode scanning functionality
 */

let scanner = null;
let scannerRunning = false;

/**
 * Initialize the barcode scanner
 */
function initBarcodeScanner() {
    // Check if the browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Thông báo', 'Trình duyệt của bạn không hỗ trợ quét mã. Vui lòng sử dụng trình duyệt khác.', 'warning');
        document.getElementById('startScanButton').disabled = true;
        return;
    }
}

/**
 * Start the barcode scanner
 */
function startScanner() {
    if (scannerRunning) return;
    
    const useBackCamera = localStorage.getItem('useBackCamera') !== 'false';
    
    // Configure Quagga
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.getElementById('barcode-scanner'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: useBackCamera ? "environment" : "user"
            },
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 10,
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "i2of5_reader",
                "2of5_reader",
                "code_93_reader"
            ]
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error("Error initializing Quagga:", err);
            showToast('Lỗi', 'Không thể khởi tạo máy quét: ' + err, 'error');
            return;
        }
        
        console.log("Quagga initialized successfully");
        
        // Start scanning
        Quagga.start();
        scannerRunning = true;
        
        // Add scan event listener
        Quagga.onDetected(onBarcodeDetected);
        
        // Add processing feedback
        Quagga.onProcessed(function(result) {
            var drawingCtx = Quagga.canvas.ctx.overlay,
                drawingCanvas = Quagga.canvas.dom.overlay;

            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                    result.boxes.filter(function (box) {
                        return box !== result.box;
                    }).forEach(function (box) {
                        Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                    });
                }

                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                }

                if (result.codeResult && result.codeResult.code) {
                    Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
                }
            }
        });
    });
}

/**
 * Handle barcode detection
 * @param {Object} result - The detected barcode result
 */
function onBarcodeDetected(result) {
    const code = result.codeResult.code;
    if (code) {
        // Play a success sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
        
        // Process the detected barcode
        console.log("Barcode detected:", code);
        
        // Send to the main logic
        processBarcode(code);
    }
}

/**
 * Stop the barcode scanner
 */
function stopScanner() {
    if (!scannerRunning) return;
    
    Quagga.stop();
    scannerRunning = false;
    
    // Hide scanner overlay
    document.getElementById('scanner-overlay').style.display = 'none';
    document.getElementById('scanner-container').classList.remove('scanning-active');
}

/**
 * Check if the scanner is currently running
 * @returns {boolean} - True if the scanner is running
 */
function isScannerRunning() {
    return scannerRunning;
}
