/**
 * UI Controller Module
 * Handles UI updates and interactions
 */

/**
 * Initialize the UI
 */
function initUI() {
    console.log('UI controller initialized');
    
    // Display version info at the bottom of settings
    const appInfo = document.getElementById('appInfo');
    if (appInfo) {
        const versionInfo = appInfo.querySelector('p:first-child');
        if (versionInfo) {
            versionInfo.textContent = 'Phiên bản: 1.0.0';
        }
    }
}

/**
 * Load and display inventory items
 */
function loadAndDisplayInventory() {
    getAllProducts().then(async (products) => {
        const tableBody = document.getElementById('inventoryTableBody');
        const noItemsDiv = document.getElementById('noInventoryItems');
        
        if (!tableBody) return;
        
        // Clear existing table rows
        tableBody.innerHTML = '';
        
        if (!products || products.length === 0) {
            if (noItemsDiv) {
                noItemsDiv.classList.remove('d-none');
            }
            return;
        }
        
        if (noItemsDiv) {
            noItemsDiv.classList.add('d-none');
        }
        
        // Get all people to display names instead of IDs
        const people = await getAllPeople();
        const peopleMap = {};
        people.forEach(person => {
            peopleMap[person.id] = person.name;
        });
        
        // Sort products by entry date (newest first)
        products.sort((a, b) => {
            const dateA = a.entryDate ? new Date(a.entryDate) : new Date(0);
            const dateB = b.entryDate ? new Date(b.entryDate) : new Date(0);
            return dateB - dateA;
        });
        
        // Create table rows
        products.forEach(product => {
            const row = document.createElement('tr');
            
            // Format date
            let formattedDate = '';
            if (product.entryDate) {
                const date = new Date(product.entryDate);
                formattedDate = `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
            }
            
            row.innerHTML = `
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.brand || ''}</td>
                <td>${product.quantity || 1}</td>
                <td>${product.unit || ''}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${peopleMap[product.personId] || ''}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary edit-product" data-id="${product.id}">
                            <i data-feather="edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger delete-product" data-id="${product.id}">
                            <i data-feather="trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Re-initialize Feather icons for new buttons
        feather.replace();
        
        // Add event listeners to edit and delete buttons
        const editButtons = document.querySelectorAll('.edit-product');
        editButtons.forEach(button => {
            button.addEventListener('click', () => {
                const productId = button.getAttribute('data-id');
                editProduct(productId);
            });
        });
        
        const deleteButtons = document.querySelectorAll('.delete-product');
        deleteButtons.forEach(button => {
            button.addEventListener('click', () => {
                const productId = button.getAttribute('data-id');
                confirmDeleteProduct(productId);
            });
        });
    }).catch(error => {
        showToast('Lỗi', `Không thể tải danh sách sản phẩm: ${error.message}`, 'error');
    });
}

/**
 * Format a number as currency (VND)
 * @param {number} amount - The amount to format
 * @returns {string} The formatted currency string
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '';
    }
    
    return amount.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Edit a product
 * @param {string} productId - The ID of the product to edit
 */
function editProduct(productId) {
    // Switch to scanning view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active-view');
    });
    document.getElementById('scanningView').classList.add('active-view');
    
    // Update active tab
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById('scanTab').classList.add('active');
    
    // Get the product and fill the form
    getProductByBarcode(productId).then(product => {
        if (product) {
            fillProductForm(product);
            document.getElementById('productForm').classList.remove('d-none');
        } else {
            showToast('Lỗi', 'Không tìm thấy sản phẩm', 'error');
        }
    }).catch(error => {
        showToast('Lỗi', `Không thể tải thông tin sản phẩm: ${error.message}`, 'error');
    });
}

/**
 * Confirm and delete a product
 * @param {string} productId - The ID of the product to delete
 */
function confirmDeleteProduct(productId) {
    getProductByBarcode(productId).then(product => {
        if (!product) {
            showToast('Lỗi', 'Không tìm thấy sản phẩm', 'error');
            return;
        }
        
        showConfirmDialog(
            'Xóa sản phẩm',
            `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}" (${product.id})?`,
            () => {
                deleteProduct(productId).then(() => {
                    loadAndDisplayInventory();
                    showToast('Thành công', 'Đã xóa sản phẩm', 'success');
                }).catch(error => {
                    showToast('Lỗi', `Không thể xóa sản phẩm: ${error.message}`, 'error');
                });
            }
        );
    }).catch(error => {
        showToast('Lỗi', `Không thể tải thông tin sản phẩm: ${error.message}`, 'error');
    });
}

/**
 * Load the person list for the settings page and dropdowns
 */
function loadPersonList() {
    getAllPeople().then(people => {
        // Update the person selector in the product form
        const entryPerson = document.getElementById('entryPerson');
        if (entryPerson) {
            // Save currently selected option
            const selectedValue = entryPerson.value;
            
            // Clear existing options except the placeholder
            while (entryPerson.options.length > 1) {
                entryPerson.remove(1);
            }
            
            // Add new options
            people.forEach(person => {
                const option = document.createElement('option');
                option.value = person.id;
                option.textContent = person.name;
                entryPerson.appendChild(option);
            });
            
            // Restore selected value if possible
            if (selectedValue) {
                for (let i = 0; i < entryPerson.options.length; i++) {
                    if (entryPerson.options[i].value === selectedValue) {
                        entryPerson.selectedIndex = i;
                        break;
                    }
                }
            }
        }
        
        // Update the person list in settings
        const personList = document.getElementById('personList');
        if (personList) {
            personList.innerHTML = '';
            
            people.forEach(person => {
                const listItem = document.createElement('div');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                
                listItem.innerHTML = `
                    <span>${person.name}</span>
                    <button class="btn btn-sm btn-outline-danger delete-person" data-id="${person.id}">
                        <i data-feather="trash-2"></i>
                    </button>
                `;
                
                personList.appendChild(listItem);
            });
            
            // Re-initialize Feather icons
            feather.replace();
            
            // Add event listeners to delete buttons
            const deleteButtons = document.querySelectorAll('.delete-person');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const personId = parseInt(button.getAttribute('data-id'));
                    confirmDeletePerson(personId);
                });
            });
        }
    }).catch(error => {
        showToast('Lỗi', `Không thể tải danh sách người nhập: ${error.message}`, 'error');
    });
}

/**
 * Confirm and delete a person
 * @param {number} personId - The ID of the person to delete
 */
function confirmDeletePerson(personId) {
    // Get person details
    getPersonById(personId).then(person => {
        if (!person) {
            showToast('Lỗi', 'Không tìm thấy người nhập', 'error');
            return;
        }
        
        showConfirmDialog(
            'Xóa người nhập',
            `Bạn có chắc chắn muốn xóa người nhập "${person.name}"?`,
            () => {
                deletePerson(personId).then(() => {
                    loadPersonList();
                    showToast('Thành công', 'Đã xóa người nhập', 'success');
                }).catch(error => {
                    showToast('Lỗi', `${error.message}`, 'error');
                });
            }
        );
    }).catch(error => {
        showToast('Lỗi', `Không thể tải thông tin người nhập: ${error.message}`, 'error');
    });
}
