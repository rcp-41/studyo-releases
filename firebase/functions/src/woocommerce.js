/**
 * WooCommerce Cloud Functions
 * All WooCommerce API logic runs here (STEALTH MODE)
 * API keys are stored securely in studio document (integrations.woocommerce)
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const DatabaseHandler = require('./handlers/DatabaseHandler');

const FieldValue = admin.firestore.FieldValue;



/**
 * Get WooCommerce credentials from Studio document
 * @param {DatabaseHandler} dbHandler 
 */
async function getWooCommerceCredentials(dbHandler) {
    const studioDoc = await dbHandler.studioDoc().get();

    if (!studioDoc.exists) {
        throw new Error('Studio not found');
    }

    const data = studioDoc.data();
    const wcConfig = data.integrations?.woocommerce;

    if (!wcConfig || !wcConfig.url || !wcConfig.consumer_key || !wcConfig.consumer_secret) {
        throw new Error('WooCommerce entegrasyonu tamamlanmamış. Lütfen Süper Admin ile iletişime geçin.');
    }

    return {
        url: wcConfig.url,
        key: wcConfig.consumer_key,
        secret: wcConfig.consumer_secret
    };
}

/**
 * Get WooCommerce API client
 * @param {DatabaseHandler} dbHandler 
 */
async function getWooCommerceApi(dbHandler) {
    const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
    const { url, key, secret } = await getWooCommerceCredentials(dbHandler);

    return new WooCommerceRestApi({
        url: url,
        consumerKey: key,
        consumerSecret: secret,
        version: 'wc/v3'
    });
}

/**
 * Test WooCommerce connection
 */
exports.testConnection = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth || request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin only');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const api = await getWooCommerceApi(dbHandler);
        const response = await api.get('system_status');

        return {
            success: true,
            version: response.data.environment?.version || 'Unknown',
            store: response.data.settings?.blogname || 'Unknown'
        };
    } catch (error) {
        throw new HttpsError('internal', `Connection failed: ${error.message}`);
    }
});

/**
 * Get WooCommerce stats for an archive
 */
exports.getStats = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { archiveId } = request.data;
    if (!archiveId) {
        throw new HttpsError('invalid-argument', 'Archive ID required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const archiveDoc = await dbHandler.collection('archives').doc(archiveId).get();

        if (!archiveDoc.exists) {
            throw new HttpsError('not-found', 'Archive not found');
        }

        const archive = archiveDoc.data();

        return {
            wcLink: archive.wcLink || null,
            wcPassword: archive.wcPassword || null,
            wcCategoryId: archive.wcCategoryId || null,
            wpUploaded: archive.wpUploaded || false,
            wcUploadedAt: archive.wcUploadedAt || null,
            imageCount: archive.wcImageCount || 0,
            wcProductIds: archive.wcProductIds || []
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Create WooCommerce category, products with Firebase Storage images
 */
exports.uploadSingle = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    // SECURITY: Only admin can upload to WooCommerce
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { archiveId, categoryName, password, images, priceList } = request.data;

    if (!archiveId || !categoryName) {
        throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
        throw new HttpsError('invalid-argument', 'No images provided');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    console.log(`📸 Creating WooCommerce gallery for ${categoryName} with ${images.length} images`);

    try {
        const api = await getWooCommerceApi(dbHandler);
        console.log(`🔗 Using WC_URL: ${api.url}`);

        let categoryId;
        let categorySlug;

        // 1. First check if category already exists
        try {
            console.log(`🔍 Checking if category "${categoryName}" already exists...`);
            const existingCategories = await api.get('products/categories', {
                search: categoryName,
                per_page: 100
            });

            const existingCategory = existingCategories.data.find(
                cat => cat.name.toLowerCase() === categoryName.toLowerCase()
            );

            if (existingCategory) {
                console.log(`📁 Found existing category: ${existingCategory.id}`);
                categoryId = existingCategory.id;
                categorySlug = existingCategory.slug;
            }
        } catch (searchError) {
            console.log(`⚠️ Category search failed, will try to create new: ${searchError.message}`);
        }

        // 2. Create category if not exists
        if (!categoryId) {
            console.log(`📁 Creating new category: ${categoryName}`);
            const categoryResponse = await api.post('products/categories', {
                name: categoryName,
                description: `Fotoğraf Galerisi - ${categoryName}`
            });
            categoryId = categoryResponse.data.id;
            categorySlug = categoryResponse.data.slug;
            console.log(`✅ Category created: ${categoryId}`);
        }

        const baseUrl = api.url.replace(/\/+$/, '');
        // Use custom permalink structure if needed, defaulting to Turkish 'urun-kategori' as requested
        const galleryUrl = `${baseUrl}/urun-kategori/${categorySlug}`;

        console.log(`📁 Using category ID: ${categoryId}, URL: ${galleryUrl}`);

        // 2. Create products for each image
        const createdProducts = [];
        const storagePaths = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                console.log(`📷 Creating product ${i + 1}/${images.length}: ${image.name}`);

                // Use SIMPLE product for reliable creation (Variable requires global attributes)
                const productData = {
                    name: image.name || `Fotoğraf ${i + 1}`,
                    type: 'simple',
                    status: 'publish', // Make visible
                    catalog_visibility: 'visible',
                    categories: [{ id: categoryId }],
                    images: [{
                        src: image.url,
                        name: image.name
                    }],
                    regular_price: priceList && priceList[0] ? priceList[0].price.toString() : '50',
                    description: `Fotoğraf: ${image.name}`,
                    short_description: categoryName
                };

                console.log(`📝 Product data:`, JSON.stringify(productData, null, 2));

                const productResponse = await api.post('products', productData);
                const productId = productResponse.data.id;

                console.log(`✅ Product created: ${productId}`);

                createdProducts.push({
                    id: productId,
                    name: image.name,
                    url: productResponse.data.permalink
                });

                // Track storage paths for cleanup
                if (image.storagePath) {
                    storagePaths.push(image.storagePath);
                }

            } catch (productError) {
                console.error(`❌ Failed to create product for ${image.name}:`);
                console.error(`   Error message: ${productError.message}`);
                if (productError.response) {
                    console.error(`   Response status: ${productError.response.status}`);
                    console.error(`   Response data:`, JSON.stringify(productError.response.data, null, 2));
                }
                // Continue with other images
            }
        }

        console.log(`✅ Created ${createdProducts.length} products`);

        // 4. Update archive with WooCommerce info
        await dbHandler.collection('archives').doc(archiveId).update({
            wcCategoryId: categoryId,
            wcLink: galleryUrl,
            wcPassword: password || null,
            wcProductIds: createdProducts.map(p => p.id),
            wcStoragePaths: storagePaths, // Store paths for cleanup on reset
            wcImageCount: images.length,
            wpUploaded: true,
            wcUploadedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return {
            success: true,
            categoryId,
            galleryUrl,
            password,
            productsCreated: createdProducts.length
        };
    } catch (error) {
        console.error('uploadSingle error:', error);
        throw new HttpsError('internal', error.message);
    }
});


/**
 * Get WooCommerce clients/orders
 */
exports.getClients = onCall({ enforceAppCheck: false }, async (request) => {
    console.log('📋 woocommerce-getClients called');

    if (!request.auth || request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin only');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const api = await getWooCommerceApi(dbHandler);
        const response = await api.get('customers', {
            per_page: 100,
            orderby: 'registered_date',
            order: 'desc'
        });

        return response.data.map(client => ({
            id: client.id,
            email: client.email,
            firstName: client.first_name,
            lastName: client.last_name,
            dateCreated: client.date_created
        }));
    } catch (error) {
        console.error('getClients error:', error.message);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Reset WooCommerce data for an archive
 * Deletes: WC products, WC category, and Firebase Storage files
 */
exports.reset = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }
    // SECURITY: Only admin can reset WooCommerce data
    if (request.auth.token.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { archiveId } = request.data;
    if (!archiveId) {
        throw new HttpsError('invalid-argument', 'Archive ID required');
    }

    const dbHandler = await DatabaseHandler.fromRequest(request);

    try {
        const archiveDoc = await dbHandler.collection('archives').doc(archiveId).get();

        if (!archiveDoc.exists) {
            throw new HttpsError('not-found', 'Archive not found');
        }

        const archive = archiveDoc.data();

        console.log(`🗑️ Resetting WooCommerce data for archive ${archiveId}`);

        // 1. Delete products from WooCommerce
        if (archive.wcProductIds && archive.wcProductIds.length > 0) {
            try {
                const api = await getWooCommerceApi(dbHandler);
                for (const productId of archive.wcProductIds) {
                    try {
                        await api.delete(`products/${productId}`, { force: true });
                    } catch (err) {
                        console.log(`Product ${productId} delete failed:`, err.message);
                    }
                }
                console.log(`✅ Deleted ${archive.wcProductIds.length} products from WooCommerce`);
            } catch (wcError) {
                console.log('WC products delete failed:', wcError.message);
            }
        }

        // 2. Delete category from WooCommerce
        if (archive.wcCategoryId) {
            try {
                const api = await getWooCommerceApi(dbHandler);
                await api.delete(`products/categories/${archive.wcCategoryId}`, {
                    force: true
                });
                console.log(`✅ Deleted category ${archive.wcCategoryId} from WooCommerce`);
            } catch (wcError) {
                console.log('WC category delete failed:', wcError.message);
            }
        }

        // 3. Delete files from Firebase Storage
        if (archive.wcStoragePaths && archive.wcStoragePaths.length > 0) {
            try {
                const bucket = admin.storage().bucket();

                for (const storagePath of archive.wcStoragePaths) {
                    try {
                        await bucket.file(storagePath).delete();
                    } catch (err) {
                        console.log(`Storage file ${storagePath} delete failed:`, err.message);
                    }
                }
                console.log(`✅ Deleted ${archive.wcStoragePaths.length} files from Firebase Storage`);
            } catch (storageError) {
                console.log('Storage delete failed:', storageError.message);
            }
        }

        // 4. Reset archive WC fields
        await dbHandler.collection('archives').doc(archiveId).update({
            wcCategoryId: null,
            wcLink: null,
            wcPassword: null,
            wcProductIds: null,
            wcStoragePaths: null,
            wcImageCount: null,
            wpUploaded: false,
            wcUploadedAt: null,
            updatedAt: FieldValue.serverTimestamp()
        });

        console.log(`✅ Archive ${archiveId} WooCommerce data reset complete`);
        return { success: true };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});
