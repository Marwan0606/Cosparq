const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const {
  getListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
  upvoteListing,
  getMyListings,
  autofillListing,
  getAutofill,
  addReview,
  getReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  migrateThumbnails
} = require('../controllers/marketplace');

// Public routes (still need auth to see who upvoted)
router.get('/', authenticateToken, getListings);
router.get('/my-listings', authenticateToken, getMyListings);
router.get('/autofill', authenticateToken, getAutofill);

// Migration route (run once to generate thumbnails for existing listings)
router.post('/migrate-thumbnails', authenticateToken, migrateThumbnails);

router.get('/:id', authenticateToken, getListing);
router.get('/:id/reviews', authenticateToken, getReviews);

// Protected routes
router.post('/', authenticateToken, createListing);
router.post('/autofill', authenticateToken, autofillListing);
router.put('/:id', authenticateToken, updateListing);
router.delete('/:id', authenticateToken, deleteListing);
router.post('/:id/upvote', authenticateToken, upvoteListing);

// Review routes
router.post('/:id/reviews', authenticateToken, addReview);
router.put('/:id/reviews/:reviewId', authenticateToken, updateReview);
router.delete('/:id/reviews/:reviewId', authenticateToken, deleteReview);
router.post('/:id/reviews/:reviewId/helpful', authenticateToken, markReviewHelpful);

module.exports = router;
