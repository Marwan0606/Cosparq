/**
 * Centralized Input Sanitization & Validation Helpers
 * 
 * Provides reusable functions for:
 * - XSS prevention (HTML entity encoding)
 * - NoSQL injection prevention (stripping $ operators from objects)
 * - Regex escaping (preventing ReDoS)
 * - Email validation
 * - Input length enforcement
 * - Type checking
 */

const xss = require('xss');
const validator = require('validator');

// ============== XSS SANITIZATION ==============

/**
 * Sanitize a string to prevent XSS attacks.
 * Strips dangerous HTML/JS while preserving readable text.
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return xss(str, {
    whiteList: {},          // No HTML tags allowed
    stripIgnoreTag: true,   // Strip all non-whitelisted tags
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  });
};

/**
 * Sanitize a string but allow basic markdown formatting.
 * Use for fields that may contain markdown (AI responses, descriptions).
 */
const sanitizeMarkdown = (str) => {
  if (typeof str !== 'string') return str;
  return xss(str, {
    whiteList: {
      b: [], i: [], em: [], strong: [], br: [], p: [],
      ul: [], ol: [], li: [], h1: [], h2: [], h3: [],
      a: ['href', 'title'], code: [], pre: [], blockquote: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  });
};

/**
 * Deep sanitize an object — recursively sanitize all string values.
 * Useful for sanitizing entire req.body objects.
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};


// ============== NoSQL INJECTION PREVENTION ==============

/**
 * Ensure a value is a plain string (not an object like {$gt: ""}).
 * Use on any req.body/req.query field going into a MongoDB query.
 */
const ensureString = (value, defaultValue = '') => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return defaultValue;
  // If someone passes an object like {$gt: ""}, reject it
  return defaultValue;
};

/**
 * Ensure a value is a number.
 */
const ensureNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Ensure a value is a boolean.
 */
const ensureBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
};

/**
 * Strip MongoDB operators from an object (keys starting with $).
 * Defense-in-depth for NoSQL injection prevention.
 */
const stripMongoOperators = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripMongoOperators);
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    cleaned[key] = typeof value === 'object' ? stripMongoOperators(value) : value;
  }
  return cleaned;
};


// ============== REGEX SAFETY ==============

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * Use before passing user input to MongoDB $regex.
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


// ============== VALIDATION HELPERS ==============

/**
 * Validate email format.
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  return validator.isEmail(email);
};

/**
 * Validate password strength.
 * Requires: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number.
 */
const isStrongPassword = (password) => {
  if (typeof password !== 'string') return false;
  return validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0, // Don't require symbols
  });
};

/**
 * Validate a phone number (basic format check).
 */
const isValidPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  // After normalizing (stripping spaces/dashes/parens), should be 7-15 digits, optionally starting with +
  const normalized = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{7,15}$/.test(normalized);
};

/**
 * Enforce max length on a string.
 */
const maxLength = (str, max) => {
  if (typeof str !== 'string') return str;
  return str.substring(0, max);
};

/**
 * Validate a string is one of allowed values (allowlist).
 */
const isOneOf = (value, allowedValues, defaultValue = null) => {
  if (allowedValues.includes(value)) return value;
  return defaultValue;
};

/**
 * Validate MongoDB ObjectId format.
 */
const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Strip newlines from a string (prevents email header injection).
 */
const stripNewlines = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/\r\n|\r|\n/g, ' ');
};

/**
 * Validate and clamp pagination parameters.
 */
const sanitizePagination = (page, limit, maxLimit = 50) => {
  let p = parseInt(page) || 1;
  let l = parseInt(limit) || 20;
  if (p < 1) p = 1;
  if (l < 1) l = 1;
  if (l > maxLimit) l = maxLimit;
  return { page: p, limit: l };
};

/**
 * Validate URL format.
 */
const isValidUrl = (url) => {
  if (typeof url !== 'string') return false;
  return validator.isURL(url, { 
    protocols: ['http', 'https'], 
    require_protocol: true 
  });
};

/**
 * Pick only allowed fields from an object (prevent mass assignment).
 */
const pickFields = (obj, allowedFields) => {
  if (!obj || typeof obj !== 'object') return {};
  const picked = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      picked[field] = obj[field];
    }
  }
  return picked;
};

/**
 * Escape a string for safe insertion into HTML (prevents reflected XSS).
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};


module.exports = {
  // XSS
  sanitizeString,
  sanitizeMarkdown,
  sanitizeObject,
  // NoSQL
  ensureString,
  ensureNumber,
  ensureBoolean,
  stripMongoOperators,
  // Regex
  escapeRegex,
  // Validation
  isValidEmail,
  isStrongPassword,
  isValidPhone,
  maxLength,
  isOneOf,
  isValidObjectId,
  stripNewlines,
  sanitizePagination,
  isValidUrl,
  pickFields,
  escapeHtml,
};
