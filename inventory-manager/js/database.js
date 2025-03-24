/**
 * Database Module
 * Handles data storage and retrieval using IndexedDB
 */

// Database variables
let db = null;
const DB_NAME = 'InventoryManagerDB';
const DB_VERSION = 1;
const STORES = {
    PRODUCTS: 'products',
    PEOPLE: 'people'
};

/**
 * Initialize the database
 * @returns {Promise} A promise that resolves when the database is ready
 */
function initDatabase() {
    return new Promise((resolve, reject) => {
        // Open database connection
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Handle database upgrade (first time or version change)
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Create products store
            if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
                const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
                productStore.createIndex('barcode', 'id', { unique: true });
            }
            
            // Create people store
            if (!db.objectStoreNames.contains(STORES.PEOPLE)) {
                const peopleStore = db.createObjectStore(STORES.PEOPLE, { keyPath: 'id', autoIncrement: true });
                peopleStore.createIndex('name', 'name', { unique: true });
            }
        };
        
        // Handle success
        request.onsuccess = function(event) {
            db = event.target.result;
            
            // Check if we need to add default people
            checkDefaultData()
                .then(() => resolve())
                .catch(err => reject(err));
        };
        
        // Handle errors
        request.onerror = function(event) {
            reject(new Error('Database error: ' + event.target.errorCode));
        };
    });
}

/**
 * Check and add default data if the database is empty
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function checkDefaultData() {
    return new Promise((resolve, reject) => {
        // Check if there are any people in the database
        const transaction = db.transaction([STORES.PEOPLE], 'readonly');
        const peopleStore = transaction.objectStore(STORES.PEOPLE);
        const countRequest = peopleStore.count();
        
        countRequest.onsuccess = function() {
            if (countRequest.result === 0) {
                // Add default people
                const defaultPeople = [
                    { name: 'Quản lý', },
                    { name: 'Nhân viên 1' },
                    { name: 'Nhân viên 2' }
                ];
                
                const addTransaction = db.transaction([STORES.PEOPLE], 'readwrite');
                const peopleStore = addTransaction.objectStore(STORES.PEOPLE);
                
                let complete = 0;
                let hasError = false;
                
                addTransaction.oncomplete = function() {
                    resolve();
                };
                
                addTransaction.onerror = function(event) {
                    reject(new Error('Error adding default people: ' + event.target.errorCode));
                };
                
                defaultPeople.forEach(person => {
                    const request = peopleStore.add(person);
                    request.onerror = function(event) {
                        console.error('Error adding person:', event);
                    };
                });
            } else {
                resolve();
            }
        };
        
        countRequest.onerror = function(event) {
            reject(new Error('Error checking for default data: ' + event.target.errorCode));
        };
    });
}

/**
 * Get a product by its barcode
 * @param {string} barcode - The product barcode to look for
 * @returns {Promise<Object|null>} A promise that resolves with the product or null if not found
 */
function getProductByBarcode(barcode) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PRODUCTS], 'readonly');
        const productStore = transaction.objectStore(STORES.PRODUCTS);
        const request = productStore.get(barcode);
        
        request.onsuccess = function() {
            resolve(request.result || null);
        };
        
        request.onerror = function(event) {
            reject(new Error('Error fetching product: ' + event.target.errorCode));
        };
    });
}

/**
 * Save a product to the database
 * @param {Object} product - The product to save
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function saveProductToDatabase(product) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        // Add timestamp if not present
        if (!product.timestamp) {
            product.timestamp = new Date().toISOString();
        }
        
        const transaction = db.transaction([STORES.PRODUCTS], 'readwrite');
        const productStore = transaction.objectStore(STORES.PRODUCTS);
        const request = productStore.put(product);
        
        request.onsuccess = function() {
            resolve();
        };
        
        request.onerror = function(event) {
            reject(new Error('Error saving product: ' + event.target.errorCode));
        };
    });
}

/**
 * Get all products from the database
 * @returns {Promise<Array>} A promise that resolves with an array of products
 */
function getAllProducts() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PRODUCTS], 'readonly');
        const productStore = transaction.objectStore(STORES.PRODUCTS);
        const request = productStore.getAll();
        
        request.onsuccess = function() {
            resolve(request.result || []);
        };
        
        request.onerror = function(event) {
            reject(new Error('Error fetching products: ' + event.target.errorCode));
        };
    });
}

/**
 * Get all people from the database
 * @returns {Promise<Array>} A promise that resolves with an array of people
 */
function getAllPeople() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PEOPLE], 'readonly');
        const peopleStore = transaction.objectStore(STORES.PEOPLE);
        const request = peopleStore.getAll();
        
        request.onsuccess = function() {
            resolve(request.result || []);
        };
        
        request.onerror = function(event) {
            reject(new Error('Error fetching people: ' + event.target.errorCode));
        };
    });
}

/**
 * Add a new person to the database
 * @param {string} name - The name of the person to add
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function addPerson(name) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PEOPLE], 'readwrite');
        const peopleStore = transaction.objectStore(STORES.PEOPLE);
        
        // First check if person already exists
        const nameIndex = peopleStore.index('name');
        const checkRequest = nameIndex.get(name);
        
        checkRequest.onsuccess = function() {
            if (checkRequest.result) {
                reject(new Error('Người nhập này đã tồn tại'));
                return;
            }
            
            // Person doesn't exist, add them
            const addRequest = peopleStore.add({ name: name });
            
            addRequest.onsuccess = function() {
                resolve();
            };
            
            addRequest.onerror = function(event) {
                reject(new Error('Lỗi khi thêm người nhập: ' + event.target.errorCode));
            };
        };
        
        checkRequest.onerror = function(event) {
            reject(new Error('Lỗi khi kiểm tra người nhập: ' + event.target.errorCode));
        };
    });
}

/**
 * Delete a person from the database
 * @param {number} id - The ID of the person to delete
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function deletePerson(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        // First check if any products use this person
        getAllProducts().then(products => {
            const personInUse = products.some(product => product.personId === id.toString());
            if (personInUse) {
                reject(new Error('Không thể xóa. Người nhập này đang được sử dụng trong danh sách sản phẩm.'));
                return;
            }
            
            // No products using this person, safe to delete
            const transaction = db.transaction([STORES.PEOPLE], 'readwrite');
            const peopleStore = transaction.objectStore(STORES.PEOPLE);
            const request = peopleStore.delete(id);
            
            request.onsuccess = function() {
                resolve();
            };
            
            request.onerror = function(event) {
                reject(new Error('Lỗi khi xóa người nhập: ' + event.target.errorCode));
            };
        }).catch(error => {
            reject(error);
        });
    });
}

/**
 * Delete a product from the database
 * @param {string} id - The ID of the product to delete
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PRODUCTS], 'readwrite');
        const productStore = transaction.objectStore(STORES.PRODUCTS);
        const request = productStore.delete(id);
        
        request.onsuccess = function() {
            resolve();
        };
        
        request.onerror = function(event) {
            reject(new Error('Lỗi khi xóa sản phẩm: ' + event.target.errorCode));
        };
    });
}

/**
 * Clear all data from the database
 * @returns {Promise} A promise that resolves when the operation is complete
 */
function clearAllData() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PRODUCTS, STORES.PEOPLE], 'readwrite');
        const productStore = transaction.objectStore(STORES.PRODUCTS);
        const clearProductsRequest = productStore.clear();
        
        clearProductsRequest.onerror = function(event) {
            reject(new Error('Lỗi khi xóa dữ liệu sản phẩm: ' + event.target.errorCode));
        };
        
        transaction.oncomplete = function() {
            // Re-add default people after clearing
            checkDefaultData()
                .then(() => resolve())
                .catch(err => reject(err));
        };
        
        transaction.onerror = function(event) {
            reject(new Error('Lỗi khi xóa tất cả dữ liệu: ' + event.target.errorCode));
        };
    });
}

/**
 * Get a person by their ID
 * @param {number} id - The ID of the person to get
 * @returns {Promise<Object|null>} A promise that resolves with the person or null if not found
 */
function getPersonById(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction([STORES.PEOPLE], 'readonly');
        const peopleStore = transaction.objectStore(STORES.PEOPLE);
        const request = peopleStore.get(parseInt(id));
        
        request.onsuccess = function() {
            resolve(request.result || null);
        };
        
        request.onerror = function(event) {
            reject(new Error('Error fetching person: ' + event.target.errorCode));
        };
    });
}
