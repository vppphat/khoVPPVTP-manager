/**
 * Excel Handler Module
 * Handles importing and exporting Excel files
 */

/**
 * Initialize the Excel handler
 */
function initExcelHandler() {
    // Nothing to initialize here
    console.log('Excel handler initialized');
}

/**
 * Export inventory data to Excel file
 */
function exportToExcel() {
    // Get all products from the database
    getAllProducts().then(async (products) => {
        if (!products || products.length === 0) {
            showToast('Thông báo', 'Không có dữ liệu để xuất', 'warning');
            return;
        }
        
        try {
            // Get all people to include names instead of IDs
            const people = await getAllPeople();
            const peopleMap = {};
            people.forEach(person => {
                peopleMap[person.id] = person.name;
            });
            
            // Format products for Excel
            const formattedProducts = products.map(product => {
                return {
                    'Mã Sản Phẩm': product.id,
                    'Tên Sản Phẩm': product.name,
                    'Thương Hiệu': product.brand,
                    'Đơn Vị': product.unit,
                    'Số Lượng': product.quantity,
                    'Giá (VND)': product.price,
                    'Màu Sắc': product.color,
                    'Kích Thước': product.size,
                    'Hình Dạng': product.shape,
                    'Người Nhập': peopleMap[product.personId] || '',
                    'Ngày Nhập': formatDateForExcel(product.entryDate),
                    'Ghi Chú': product.notes
                };
            });
            
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(formattedProducts);
            
            // Set column widths
            const columnWidths = [
                { wch: 15 }, // Mã Sản Phẩm
                { wch: 25 }, // Tên Sản Phẩm
                { wch: 15 }, // Thương Hiệu
                { wch: 10 }, // Đơn Vị
                { wch: 10 }, // Số Lượng
                { wch: 15 }, // Giá
                { wch: 12 }, // Màu Sắc
                { wch: 12 }, // Kích Thước
                { wch: 12 }, // Hình Dạng
                { wch: 15 }, // Người Nhập
                { wch: 20 }, // Ngày Nhập
                { wch: 30 }  // Ghi Chú
            ];
            ws['!cols'] = columnWidths;
            
            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Hàng Hóa');
            
            // Generate filename
            const exportFileName = document.getElementById('exportFileName').value || 'inventory_export';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `${exportFileName}_${timestamp}.xlsx`;
            
            // Export the file
            XLSX.writeFile(wb, filename);
            
            showToast('Thành công', 'Đã xuất dữ liệu ra file Excel', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Lỗi', `Không thể xuất dữ liệu: ${error.message}`, 'error');
        }
    }).catch(error => {
        showToast('Lỗi', `Không thể lấy dữ liệu sản phẩm: ${error.message}`, 'error');
    });
}

/**
 * Format a date string for Excel
 * @param {string} dateStr - The date string to format
 * @returns {string} The formatted date string
 */
function formatDateForExcel(dateStr) {
    if (!dateStr) return '';
    
    try {
        // Parse the date (could be in ISO format from the form)
        const date = new Date(dateStr);
        
        // Format as a readable date string (DD/MM/YYYY HH:MM)
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
        console.error('Date formatting error:', e);
        return dateStr; // Return original if there's an error
    }
}

/**
 * Import data from an Excel file
 * @param {File} file - The Excel file to import
 */
function importFromExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first worksheet
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (!jsonData || jsonData.length === 0) {
                showToast('Thông báo', 'File Excel không chứa dữ liệu hợp lệ', 'warning');
                return;
            }
            
            // Process the data
            processExcelData(jsonData);
        } catch (error) {
            console.error('Import error:', error);
            showToast('Lỗi', `Không thể đọc file Excel: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        showToast('Lỗi', 'Không thể đọc file', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * Process data imported from Excel and save to the database
 * @param {Array} data - The array of product data from Excel
 */
async function processExcelData(data) {
    try {
        // Get all people
        const people = await getAllPeople();
        const peopleByName = {};
        people.forEach(person => {
            peopleByName[person.name.toLowerCase()] = person.id;
        });
        
        // Store unknown people to add
        const unknownPeople = new Set();
        
        // Convert Excel field names to our data model
        const products = data.map(item => {
            // Determine the field names in the Excel file
            const fields = Object.keys(item);
            
            // Find the appropriate field names
            const getField = (possibleNames) => {
                const fieldName = fields.find(field => 
                    possibleNames.some(name => field.toLowerCase().includes(name.toLowerCase())));
                return fieldName ? item[fieldName] : '';
            };
            
            // Map person by name if possible
            let personId = '';
            const personName = getField(['Người Nhập', 'Person', 'User', 'Người']);
            if (personName) {
                const personNameLower = personName.toLowerCase();
                if (peopleByName[personNameLower]) {
                    personId = peopleByName[personNameLower];
                } else {
                    // Add to unknown people to add later
                    unknownPeople.add(personName);
                }
            }
            
            // Parse date if needed
            let entryDate = getField(['Ngày Nhập', 'Date', 'Entry Date', 'Ngày']);
            if (entryDate && typeof entryDate === 'string') {
                // Try to parse various date formats
                const dateParts = entryDate.split(/[\s\/\-:]/g).filter(part => part.trim());
                if (dateParts.length >= 3) {
                    // Try to detect format based on values
                    let year, month, day, hours = '00', minutes = '00';
                    
                    // Check if first part is day or year
                    if (parseInt(dateParts[0]) > 31) {
                        // Likely year first
                        year = dateParts[0];
                        month = dateParts[1].padStart(2, '0');
                        day = dateParts[2].padStart(2, '0');
                    } else {
                        // Likely day first
                        day = dateParts[0].padStart(2, '0');
                        month = dateParts[1].padStart(2, '0');
                        year = dateParts[2];
                        // If year has 2 digits, assume 2000s
                        if (year.length === 2) year = `20${year}`;
                    }
                    
                    // Check for time parts
                    if (dateParts.length >= 5) {
                        hours = dateParts[3].padStart(2, '0');
                        minutes = dateParts[4].padStart(2, '0');
                    }
                    
                    entryDate = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
            
            return {
                id: getField(['Mã Sản Phẩm', 'ID', 'Code', 'Barcode', 'Mã']),
                name: getField(['Tên Sản Phẩm', 'Name', 'Product Name', 'Tên']),
                brand: getField(['Thương Hiệu', 'Brand', 'Nhãn Hiệu', 'Hiệu']),
                unit: getField(['Đơn Vị', 'Unit', 'Đơn vị']),
                quantity: parseInt(getField(['Số Lượng', 'Quantity', 'Qty', 'SL'])) || 1,
                price: parseFloat(getField(['Giá', 'Price', 'Cost', 'Đơn Giá', 'Giá (VND)'])) || 0,
                color: getField(['Màu Sắc', 'Color', 'Màu']),
                size: getField(['Kích Thước', 'Size', 'Kích cỡ']),
                shape: getField(['Hình Dạng', 'Shape', 'Kiểu Dáng', 'Dáng']),
                notes: getField(['Ghi Chú', 'Notes', 'Note', 'Comment', 'Description']),
                entryDate: entryDate,
                personId: personId
            };
        }).filter(product => {
            // Filter out products with no ID or name
            return product.id && product.name;
        });
        
        if (products.length === 0) {
            showToast('Thông báo', 'Không tìm thấy dữ liệu sản phẩm hợp lệ trong file', 'warning');
            return;
        }
        
        // Add unknown people first (if any)
        if (unknownPeople.size > 0) {
            const peopleToAdd = Array.from(unknownPeople);
            for (const personName of peopleToAdd) {
                try {
                    await addPerson(personName);
                } catch (e) {
                    console.log(`Person ${personName} already exists or couldn't be added`);
                }
            }
            
            // Get updated people list
            const updatedPeople = await getAllPeople();
            updatedPeople.forEach(person => {
                peopleByName[person.name.toLowerCase()] = person.id;
            });
            
            // Update person IDs
            products.forEach(product => {
                const personName = item => {
                    const fieldName = fields.find(field => 
                        ['Người Nhập', 'Person', 'User', 'Người'].some(name => 
                            field.toLowerCase().includes(name.toLowerCase())));
                    return fieldName ? item[fieldName] : '';
                };
                
                if (!product.personId && personName) {
                    const personNameLower = personName.toLowerCase();
                    if (peopleByName[personNameLower]) {
                        product.personId = peopleByName[personNameLower];
                    }
                }
            });
        }
        
        // Save all products
        let successCount = 0;
        let errorCount = 0;
        
        for (const product of products) {
            try {
                await saveProductToDatabase(product);
                successCount++;
            } catch (e) {
                console.error(`Error saving product ${product.id}:`, e);
                errorCount++;
            }
        }
        
        // Refresh UI
        loadAndDisplayInventory();
        
        // Show results
        if (errorCount === 0) {
            showToast('Thành công', `Đã nhập ${successCount} sản phẩm từ file Excel`, 'success');
        } else {
            showToast('Hoàn tất với lỗi', `Đã nhập ${successCount} sản phẩm, ${errorCount} lỗi`, 'warning');
        }
    } catch (error) {
        console.error('Processing error:', error);
        showToast('Lỗi', `Xử lý dữ liệu thất bại: ${error.message}`, 'error');
    }
}
