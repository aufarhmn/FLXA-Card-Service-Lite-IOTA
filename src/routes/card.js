const express = require('express')
const router = express.Router()

const { isAuthenticated } = require('../middlewares/auth')

const {
  viewCard,
  addCard,
  verifyCard,
  deleteCard,
  addCardViaGSM,
  activateBalanceGSM
} = require('../controllers/card')

router.get('/view', isAuthenticated, viewCard)
router.post('/add', isAuthenticated, addCard)
router.post('/verify', isAuthenticated, verifyCard)
router.delete('/delete', isAuthenticated, deleteCard)
router.post('/gsm/add', addCardViaGSM)
router.post('/gsm/activate', activateBalanceGSM)

module.exports = router
