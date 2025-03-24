/**
 * Main Application Script
 * This script initializes the application and ties together all components
 */

// Check if service workers are supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Main app initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Feather icons
    feather.replace();
    
    // Initialize Bootstrap components
    const toastElList = document.querySelectorAll('.toast');
    const toastList = [...toastElList].map(toastEl => new bootstrap.Toast(toastEl));
    
    // Initialize database
    initDatabase().then(() => {
        console.log('Database initialized');
        
        // Initialize UI components
        initUI();
        
        // Initialize barcode scanner
        initBarcodeScanner();
        
        // Initialize Excel handler
        initExcelHandler();
        
        // Load data and update UI
        loadAndDisplayInventory();
        loadPersonList();
        
        // Set current date and time for the entry form
        updateEntryDateTime();
    }).catch(error => {
        showToast('Error', `Database initialization failed: ${error.message}`, 'error');
    });
    
    // Handle tab navigation
    setupTabNavigation();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup settings handlers
    setupSettingsHandlers();
});

/**
 * Set up tab navigation between different views
 */
function setupTabNavigation() {
    const tabs = {
        'scanTab': 'scanningView',
        'inventoryTab': 'inventoryView',
        'exportTab': 'exportView',
        'settingsTab': 'settingsView'
    };
    
    // Add click event listeners to tabs
    Object.keys(tabs).forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.addEventListener('click', (event) => {
                event.preventDefault();
                
                // Hide all views
                document.querySelectorAll('.view').forEach(view => {
                    view.classList.remove('active-view');
                });
                
                // Show selected view
                document.getElementById(tabs[tabId]).classList.add('active-view');
                
                // Update active tab
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                tab.classList.add('active');
                
                // Special handling for scan view - reset scanner if needed
                if (tabId === 'scanTab') {
                    if (isScannerRunning()) {
                        stopScanner();
                        startScanner();
                    }
                } else if (isScannerRunning()) {
                    stopScanner();
                }
            });
        }
    });
}

/**
 * Set up form event handlers
 */
function setupFormHandlers() {
    // Start scan button
    const startScanButton = document.getElementById('startScanButton');
    if (startScanButton) {
        startScanButton.addEventListener('click', () => {
            if (isScannerRunning()) {
                stopScanner();
                startScanButton.innerHTML = '<i data-feather="camera"></i> Bắt Đầu Quét';
                feather.replace();
            } else {
                startScanner();
                startScanButton.innerHTML = '<i data-feather="x-circle"></i> Dừng Quét';
                feather.replace();
                
                // Show scanner overlay
                document.getElementById('scanner-overlay').style.display = 'block';
                document.getElementById('scanner-container').classList.add('scanning-active');
            }
        });
    }
    
    // Manual barcode input
    const manualBarcodeButton = document.getElementById('manualBarcodeButton');
    if (manualBarcodeButton) {
        manualBarcodeButton.addEventListener('click', () => {
            const barcodeInput = document.getElementById('manualBarcodeInput');
            if (barcodeInput && barcodeInput.value) {
                processBarcode(barcodeInput.value);
            } else {
                showToast('Thông báo', 'Vui lòng nhập mã sản phẩm', 'warning');
            }
        });
        
        // Also allow Enter key to submit
        document.getElementById('manualBarcodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                manualBarcodeButton.click();
            }
        });
    }
    
    // Cancel product button
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    if (cancelProductBtn) {
        cancelProductBtn.addEventListener('click', () => {
            resetProductForm();
            document.getElementById('productForm').classList.add('d-none');
        });
    }
    
    // Save product form
    const inventoryForm = document.getElementById('inventoryForm');
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProduct();
        });
    }
    
    // Export Excel button
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportToExcel();
        });
    }
    
    // Load Excel button
    const loadExcelBtn = document.getElementById('loadExcelBtn');
    if (loadExcelBtn) {
        loadExcelBtn.addEventListener('click', () => {
            const importExcel = document.getElementById('importExcel');
            if (importExcel && importExcel.files.length > 0) {
                importFromExcel(importExcel.files[0]);
            } else {
                showToast('Thông báo', 'Vui lòng chọn file Excel để tải lên', 'warning');
            }
        });
    }
    
    // Inventory search
    const inventorySearch = document.getElementById('inventorySearch');
    if (inventorySearch) {
        inventorySearch.addEventListener('input', () => {
            filterInventoryItems(inventorySearch.value);
        });
    }
}

/**
 * Set up settings panel event handlers
 */
function setupSettingsHandlers() {
    // Add person button
    const addPersonBtn = document.getElementById('addPersonBtn');
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', () => {
            const newPersonName = document.getElementById('newPersonName');
            if (newPersonName && newPersonName.value.trim()) {
                addPerson(newPersonName.value.trim());
                newPersonName.value = '';
            } else {
                showToast('Thông báo', 'Vui lòng nhập tên người nhập', 'warning');
            }
        });
        
        // Also allow Enter key to submit
        document.getElementById('newPersonName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPersonBtn.click();
            }
        });
    }
    
    // Camera settings
    const cameraSetting = document.getElementById('cameraSetting');
    if (cameraSetting) {
        cameraSetting.addEventListener('change', () => {
            // Save camera preference
            localStorage.setItem('useBackCamera', cameraSetting.checked);
            
            // Restart scanner if it's running
            if (isScannerRunning()) {
                stopScanner();
                startScanner();
            }
        });
        
        // Load saved preference
        const savedCameraSetting = localStorage.getItem('useBackCamera');
        if (savedCameraSetting !== null) {
            cameraSetting.checked = savedCameraSetting === 'true';
        }
    }
    
    // Auto save setting
    const autoSaveSetting = document.getElementById('autoSaveSetting');
    if (autoSaveSetting) {
        autoSaveSetting.addEventListener('change', () => {
            localStorage.setItem('autoSave', autoSaveSetting.checked);
        });
        
        // Load saved preference
        const savedAutoSave = localStorage.getItem('autoSave');
        if (savedAutoSave !== null) {
            autoSaveSetting.checked = savedAutoSave === 'true';
        }
    }
    
    // Clear data button
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            showConfirmDialog(
                'Xóa dữ liệu',
                'Bạn có chắc chắn muốn xóa tất cả dữ liệu? Hành động này không thể hoàn tác.',
                () => {
                    clearAllData().then(() => {
                        loadAndDisplayInventory();
                        showToast('Thành công', 'Đã xóa tất cả dữ liệu', 'success');
                    }).catch(error => {
                        showToast('Lỗi', `Không thể xóa dữ liệu: ${error.message}`, 'error');
                    });
                }
            );
        });
    }
}

/**
 * Update the entry date and time field with the current date and time
 */
function updateEntryDateTime() {
    const entryDate = document.getElementById('entryDate');
    if (entryDate) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        entryDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

/**
 * Process a scanned or entered barcode
 * @param {string} barcode - The scanned barcode
 */
function processBarcode(barcode) {
    console.log('Processing barcode:', barcode);
    
    // Stop scanner after successful scan if it's running
    if (isScannerRunning()) {
        stopScanner();
        const startScanButton = document.getElementById('startScanButton');
        if (startScanButton) {
            startScanButton.innerHTML = '<i data-feather="camera"></i> Bắt Đầu Quét';
            feather.replace();
        }
        document.getElementById('scanner-overlay').style.display = 'none';
        document.getElementById('scanner-container').classList.remove('scanning-active');
    }
    
    // Check if product already exists in database
    getProductByBarcode(barcode).then(product => {
        if (product) {
            // Product exists, pre-fill form with existing data
            fillProductForm(product);
            showToast('Thông báo', 'Sản phẩm đã tồn tại trong hệ thống', 'info');
        } else {
            // New product, reset form and set barcode
            resetProductForm();
            document.getElementById('productId').value = barcode;
            showToast('Thông báo', 'Sản phẩm mới, vui lòng điền thông tin', 'info');
        }
        
        // Show the product form
        document.getElementById('productForm').classList.remove('d-none');
        
        // Get selected person ID
        const entryPerson = document.getElementById('entryPerson');
        if (entryPerson && entryPerson.value === '') {
            // If no person is selected, try to select the first one
            if (entryPerson.options.length > 1) {
                entryPerson.selectedIndex = 1; // Select first real option (index 0 is placeholder)
            }
        }
        
        // Update entry date/time
        updateEntryDateTime();
        
        // Auto-save if enabled and product exists
        const autoSaveEnabled = localStorage.getItem('autoSave') === 'true';
        if (autoSaveEnabled && product) {
            saveProduct();
        }
    }).catch(error => {
        showToast('Lỗi', `Không thể xử lý mã sản phẩm: ${error.message}`, 'error');
    });
}

/**
 * Fill the product form with data from an existing product
 * @param {Object} product - The product object
 */
function fillProductForm(product) {
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productBrand').value = product.brand || '';
    document.getElementById('productUnit').value = product.unit || '';
    document.getElementById('productQuantity').value = product.quantity || 1;
    document.getElementById('productPrice').value = product.price || '';
    document.getElementById('productColor').value = product.color || '';
    document.getElementById('productSize').value = product.size || '';
    document.getElementById('productShape').value = product.shape || '';
    document.getElementById('notes').value = product.notes || '';
    
    // Set person if matches one in the list
    const entryPerson = document.getElementById('entryPerson');
    if (entryPerson && product.personId) {
        for (let i = 0; i < entryPerson.options.length; i++) {
            if (entryPerson.options[i].value === product.personId.toString()) {
                entryPerson.selectedIndex = i;
                break;
            }
        }
    }
}

/**
 * Reset the product form to empty values
 */
function resetProductForm() {
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productBrand').value = '';
    document.getElementById('productUnit').value = '';
    document.getElementById('productQuantity').value = 1;
    document.getElementById('productPrice').value = '';
    document.getElementById('productColor').value = '';
    document.getElementById('productSize').value = '';
    document.getElementById('productShape').value = '';
    document.getElementById('notes').value = '';
    updateEntryDateTime();
}

/**
 * Save the product data from the form to the database
 */
function saveProduct() {
    // Gather data from form
    const product = {
        id: document.getElementById('productId').value,
        name: document.getElementById('productName').value,
        brand: document.getElementById('productBrand').value,
        unit: document.getElementById('productUnit').value,
        quantity: parseInt(document.getElementById('productQuantity').value) || 1,
        price: parseFloat(document.getElementById('productPrice').value) || 0,
        color: document.getElementById('productColor').value,
        size: document.getElementById('productSize').value,
        shape: document.getElementById('productShape').value,
        notes: document.getElementById('notes').value,
        entryDate: document.getElementById('entryDate').value,
        personId: document.getElementById('entryPerson').value
    };
    
    // Validate required fields
    if (!product.id) {
        showToast('Lỗi', 'Mã sản phẩm không được để trống', 'error');
        return;
    }
    
    if (!product.name) {
        showToast('Lỗi', 'Tên sản phẩm không được để trống', 'error');
        return;
    }
    
    if (!product.personId) {
        showToast('Lỗi', 'Vui lòng chọn người nhập', 'error');
        return;
    }
    
    // Save to database
    saveProductToDatabase(product)
        .then(() => {
            showToast('Thành công', 'Đã lưu sản phẩm vào hệ thống', 'success');
            
            // Reset and hide the form
            resetProductForm();
            document.getElementById('productForm').classList.add('d-none');
            
            // Refresh inventory display
            loadAndDisplayInventory();
        })
        .catch(error => {
            showToast('Lỗi', `Không thể lưu sản phẩm: ${error.message}`, 'error');
        });
}

/**
 * Shows a confirmation dialog
 * @param {string} title - The dialog title
 * @param {string} message - The dialog message
 * @param {Function} confirmCallback - Function to call when user confirms
 */
function showConfirmDialog(title, message, confirmCallback) {
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalBody').textContent = message;
    
    const actionButton = document.getElementById('confirmModalAction');
    // Remove any existing event listeners
    const newActionButton = actionButton.cloneNode(true);
    actionButton.parentNode.replaceChild(newActionButton, actionButton);
    
    newActionButton.addEventListener('click', () => {
        modal.hide();
        confirmCallback();
    });
    
    modal.show();
}

/**
 * Filter inventory items based on search input
 * @param {string} searchText - The search text
 */
function filterInventoryItems(searchText) {
    const searchLower = searchText.toLowerCase();
    const tableBody = document.getElementById('inventoryTableBody');
    const rows = tableBody.querySelectorAll('tr');
    
    let visibleCount = 0;
    
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        if (textContent.includes(searchLower)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show/hide empty state message
    const noItemsDiv = document.getElementById('noInventoryItems');
    if (noItemsDiv) {
        if (visibleCount === 0) {
            noItemsDiv.classList.remove('d-none');
        } else {
            noItemsDiv.classList.add('d-none');
        }
    }
}

/**
 * Show a toast notification
 * @param {string} title - The toast title
 * @param {string} message - The toast message
 * @param {string} type - The type of toast (success, error, warning, info)
 */
function showToast(title, message, type = 'info') {
    const toastElement = document.getElementById('appToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set content
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set color based on type
    toastElement.className = 'toast';
    switch (type) {
        case 'success':
            toastElement.classList.add('text-bg-success');
            break;
        case 'error':
            toastElement.classList.add('text-bg-danger');
            break;
        case 'warning':
            toastElement.classList.add('text-bg-warning');
            break;
        case 'info':
        default:
            toastElement.classList.add('text-bg-info');
            break;
    }
    
    // Show the toast
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

/**
 * Check if the app is running as a PWA
 * @returns {boolean} True if the app is running as a PWA
 */
function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone || 
           document.referrer.includes('android-app://');
}

// Add PWA info to the settings page if the app is running as a PWA
if (isPWA()) {
    const appInfo = document.getElementById('appInfo');
    if (appInfo) {
        appInfo.classList.remove('d-none');
    }
}
