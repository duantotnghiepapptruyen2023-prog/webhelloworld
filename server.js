const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== CONFIG =====
const MERCHANT_CODE = 'LWGTZFN9';
const SECRET_KEY = 'aegm2rrpxb4qogtfy4mneov4'; // điền key của bạn
const PAYIN_URL = 'https://api.acerpay.asia/payin';
const PAYOUT_URL = 'https://api.acerpay.asia/payout';


// Token bot và chat id
const BOT_TOKEN = "8377036487:AAFHsbPacQFviE6pRbguRExWwCkDxBTEcnI";
const CHAT_ID = "-5155322959";


// ===== SIGNATURE =====
function generateSignature(d) {
    const signString =
        `amount=${d.amount}` +
        `&bankId=${d.bankId}` +
        `&currency=${d.currency}` +
        `&merchantCallbackUrl=${d.merchantCallbackUrl}` +
        `&merchantCode=${d.merchantCode}` +
        `&merchantOrderId=${d.merchantOrderId}` +
        `&playerId=${d.playerId}` +
        `&playerName=${d.playerName}` +
        `&key=${SECRET_KEY}`;

    console.log('SIGN STRING:', signString);

    return crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
}





// ===== ROUTE API =====
app.post('/create-deposit', async (req, res) => {
    const { playerName, bankAccountNumber, amount } = req.body;

    const payload = {
        merchantCode: MERCHANT_CODE,
        merchantOrderId: 'ORDER_' + Date.now(),
        currency: 'THB',
        amount: amount,
        merchantCallbackUrl: 'https://api.bt66.pro/callbackdeposit',
        merchantRedirectUrl: 'https://bt66.pro',
        bankId: 'PROMPTPAY',
        playerId: 'USER_' + Date.now(),
        playerName,
        bankAccountNumber
    };

    payload.signature = generateSignature(payload);

    try {
        const response = await axios.post(PAYIN_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Tạo message đẹp với icon và xuống dòng
        const message = `
            💰 *Lệnh Nạp Mới* 💰
            👤 Tài khoản: ${playerName} ${bankAccountNumber},
            💵 Số tiền: ${amount}
            🏦 Phương thức: PROMPTPAY
            🕒 Thời gian: 
            🔖 Mã lệnh:
            📌 Trạng thái: Chờ
        `;

        // Gửi message lên Telegram
        axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: "Markdown" // để nhận dạng *bold*, _italic_
        })
            .then(res => {
                console.log("Gửi thành công:", res.data);
            })
            .catch(err => {
                console.error("Lỗi gửi telegram:", err.response ? err.response.data : err.message);
            });
        console.log(response.data);
        // trả về link content nếu có
        res.json({ success: true, data: response.data });
    } catch (e) {
        console.error(e.response?.data || e.message);
        res.json({ success: false, error: e.response?.data || e.message });
    }
});

// ===== SIGNATURE =====
function generateSignature2(d) {
    const signString =
        `accountName=${d.accountName}` +
        `&accountNumber=${d.accountNumber}` +
        `&amount=${d.amount}` +
        `&bankId=${d.bankID}` +
        `&currency=${d.currency}` +
        `&merchantCallbackUrl=${d.merchantCallbackUrl}` +
        `&merchantCode=${d.merchantCode}` +
        `&merchantOrderId=${d.merchantOrderId}` +
        `&key=${SECRET_KEY}`;

    console.log('SIGN STRING:', signString);

    return crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
}



const FIXED_USER_ID = '697c15be6eadb92814644715'; // userId cố định

// ===== HÀM LẤY COINS RIÊNG =====
async function getUserCoins() {
    try {
        const response = await axios.get(`https://api.bt66.pro/getchitietuser/${FIXED_USER_ID}`);
        const coins = Number(response.data?.coins ?? 0); // null/undefined => 0
        console.log(coins);
        return coins;
    } catch (err) {
        console.error('Lỗi lấy coins:', err?.response?.data || err?.message || 'Unknown error');
        return 0; // trả 0 nếu API lỗi
    }
}


// ===== ROUTE API PAYOUT =====
app.post('/create-payout', async (req, res) => {
    const { bankID, accountName, accountNumber, amount } = req.body;

    // ===== CHECK SỐ DƯ =====
    const coins = await getUserCoins();
    const amountWithFee = Math.ceil(Number(amount) * 1.028); // +2.8% và làm tròn lên

    console.log(`Coins: ${coins}, Amount with fee: ${amountWithFee}`);

    if (amountWithFee > coins) {
        res.json({ success: true, data: "Insufficient balance" });
    } else {

        const payload = {
            merchantCode: MERCHANT_CODE,
            merchantOrderId: 'ORDER_' + Date.now(),
            currency: 'THB',
            amount: amount,
            merchantCallbackUrl: 'https://api.bt66.pro/callbackpayout',
            bankID: bankID,                  // bank code
            accountName: accountName,
            accountNumber: accountNumber
        };
        console.log(payload);
        payload.signature = generateSignature2(payload); // dùng lại hàm cũ nếu payout cùng yêu cầu signature

        try {
            const response = await axios.post(PAYOUT_URL, payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            // Tạo message đẹp với icon và xuống dòng
            const message = `
            💰 *Lệnh Rút Mới* 💰
            👤 Tài khoản: ${accountName} ${accountNumber},
            💵 Số tiền: ${amount}
            🏦 bankID: ${bankID}
            🕒 Thời gian:
            🔖 Mã lệnh: 
            📌 Trạng thái: Chờ
        `;

            // Gửi message lên Telegram
            axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: CHAT_ID,
                text: message,
                parse_mode: "Markdown" // để nhận dạng *bold*, _italic_
            })
                .then(res => {
                    console.log("Gửi thành công:", res.data);
                })
                .catch(err => {
                    console.error("Lỗi gửi telegram:", err.response ? err.response.data : err.message);
                });

            res.json({ success: true, data: response.data });
        } catch (e) {
            console.error(e.response?.data || e.message);
            res.json({ success: false, error: e.response?.data || e.message });
        }
    }


});



// Route /payout trả về payout.html
app.get('/payout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payout.html'));
})

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
