/**
 * Zod Validation Schemas
 * Tüm API endpoint'leri için input doğrulama şemaları
 */
const { z } = require('zod');

const archiveSchema = z.object({
    fullName: z.string().min(2).max(100),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional().or(z.literal('')),
    shootTypeId: z.string().optional(),
    locationId: z.string().optional(),
    photographerId: z.string().optional(),
    description1: z.string().max(1000).optional().default(''),
    description2: z.string().max(1000).optional().default(''),
    totalAmount: z.number().min(0).optional().default(0),
    cashAmount: z.number().min(0).optional().default(0),
    cardAmount: z.number().min(0).optional().default(0),
    transferAmount: z.number().min(0).optional().default(0),
});

const appointmentSchema = z.object({
    fullName: z.string().min(2).max(100),
    phone: z.string().min(10).max(15),
    shootTypeId: z.string().optional(),
    description1: z.string().max(1000).optional().default(''),
    description2: z.string().max(1000).optional().default(''),
    appointmentDate: z.string(),
    timeSlot: z.string(),
    duration: z.number().min(15).max(480).optional().default(60),
    studioRoom: z.string().max(100).optional().default(''),
});

const customerSchema = z.object({
    fullName: z.string().min(2).max(100),
    phone: z.string().min(10).max(15),
    email: z.string().email().optional().or(z.literal('')),
    customerType: z.enum(['individual', 'corporate']).optional().default('individual'),
    source: z.enum(['walk-in', 'instagram', 'google', 'referral', 'website', 'other']).optional(),
    isVip: z.boolean().optional().default(false),
    notes: z.string().max(2000).optional().default(''),
    address: z.string().max(500).optional().default(''),
});

const userSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    fullName: z.string().min(2).max(100),
    role: z.enum(['admin', 'user']),
});

const shootSchema = z.object({
    customerId: z.string().min(1),
    customerName: z.string().max(100).optional().default(''),
    shootTypeId: z.string().optional().default(''),
    shootTypeName: z.string().max(100).optional().default(''),
    locationId: z.string().optional().default(''),
    locationName: z.string().max(100).optional().default(''),
    photographerId: z.string().optional().default(''),
    photographerName: z.string().max(100).optional().default(''),
    shootDate: z.string(),
    timeSlot: z.string().optional().default(''),
    packageId: z.string().optional().default(''),
    notes: z.string().max(2000).optional().default(''),
});

const expenseSchema = z.object({
    date: z.string(),
    category: z.string().min(1),
    subCategory: z.string().max(200).optional().default(''),
    description: z.string().max(500).optional().default(''),
    amount: z.number().positive(),
    note: z.string().max(1000).optional().default(''),
});

const leaveSchema = z.object({
    userId: z.string().min(1),
    startDate: z.string(),
    endDate: z.string(),
    type: z.string().min(1),
    note: z.string().max(1000).optional().default(''),
});

const studioSchema = z.object({
    name: z.string().min(2).max(100),
    ownerName: z.string().max(100).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(15).optional(),
    adminPassword: z.string().min(8).max(100),
    userPassword: z.string().min(8).max(100),
    licenseKey: z.string().optional(),
    hwidLock: z.boolean().optional(),
});

/**
 * Validate data against a Zod schema
 * @param {z.ZodSchema} schema
 * @param {object} data
 * @param {string} context - Context for error messages
 * @returns {object} Validated and parsed data
 */
function validate(schema, data, context = '') {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('invalid-argument', `Geçersiz veri${context ? ` (${context})` : ''}: ${errors}`);
    }
    return result.data;
}

// Photo Selector schemas
const schoolSchema = z.object({
    name: z.string().min(2).max(200),
    address: z.string().max(500).optional().default(''),
    classes: z.array(z.string().max(10)).max(100).optional().default([]),
    contactPerson: z.string().max(100).optional().default(''),
    contactPhone: z.string().max(15).optional().default(''),
    isActive: z.boolean().optional().default(true),
});

const priceListSchema = z.object({
    name: z.string().min(1).max(100),
    isActive: z.boolean().optional().default(true),
    vesikalik_biyometrik: z.object({
        adet: z.record(z.string(), z.number().min(0)),
    }).optional(),
    standart_olculer: z.record(z.string(), z.number().min(0)).optional(),
    cogaltma_carpan: z.number().min(0).max(1).optional().default(0.5),
    yillik: z.object({
        poz_fiyat: z.number().min(0),
        standart_olcu: z.string().max(10).optional().default('15x21'),
        hediye_ucretsiz: z.boolean().optional().default(true),
        cogaltma_carpan: z.number().min(0).max(1).optional().default(0.5),
    }).optional(),
    cerceve: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
    fotoblok: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
    kanvas_tablo: z.object({
        varsayilan: z.number().min(0),
        olculer: z.record(z.string(), z.number().min(0)).optional(),
    }).optional(),
});

const photoSelectionDataSchema = z.object({
    version: z.number().int().min(1).max(10),
    completedAt: z.string(),
    shootCategory: z.enum(['vesikalik_biyometrik', 'aile_ajans', 'yillik', 'etkinlik']),
    priceListId: z.string().optional(),
    selectedPhotos: z.array(z.object({
        originalName: z.string().max(300),
        renamedTo: z.string().max(300),
        orderNumber: z.number().int().min(1),
        options: z.record(z.string(), z.unknown()),
        price: z.number().min(0),
    })).max(500),
    totalPhotos: z.number().int().min(0),
    favoriteCount: z.number().int().min(0),
    selectedCount: z.number().int().min(0),
    totalPrice: z.number().min(0),
    notes: z.string().max(2000).optional().default(''),
});

module.exports = {
    archiveSchema,
    appointmentSchema,
    customerSchema,
    userSchema,
    shootSchema,
    expenseSchema,
    leaveSchema,
    studioSchema,
    schoolSchema,
    priceListSchema,
    photoSelectionDataSchema,
    validate,
};
