require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Resend Configuration
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey || apiKey.includes('your_api_key_here')) {
    console.error('ERROR: No se encontró la RESEND_API_KEY.');
    process.exit(1);
}
const resend = new Resend(apiKey);

// Rara Raíz
app.get('/', (req, res) => {
    res.send('Villas Maribella API is running');
});

// Endpoint para enviar correos de confirmación
app.post('/api/send-email', async (req, res) => {
    const { guestName, guestEmail, reservationId, checkIn, checkOut, total, villaNumber } = req.body;

    try {
        const { data, error } = await resend.emails.send({
            from: 'Villas Maribella <onboarding@resend.dev>', // Usa tu dominio verificado en produccion
            to: [guestEmail],
            subject: `Confirmación de Reserva #${reservationId} - Villas Maribella`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #00B4D8; padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
                        <h1>¡Reserva Confirmada!</h1>
                    </div>
                    <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                        <p>Hola <strong>${guestName}</strong>,</p>
                        <p>Estamos encantados de confirmar tu estadía en <strong>Villas Maribella</strong>.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="color: #0077B6; margin-top: 0;">Detalles de la Reserva</h3>
                            <p><strong>Código:</strong> ${reservationId}</p>
                            <p><strong>Villa:</strong> #${villaNumber}</p>
                            <p><strong>Check-in:</strong> ${checkIn}</p>
                            <p><strong>Check-out:</strong> ${checkOut}</p>
                            <p><strong>Total:</strong> $${total}</p>
                        </div>

                        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                        <p style="margin-top: 30px;">¡Te esperamos pronto!</p>
                        <hr>
                        <p style="font-size: 12px; color: #999;">Calle Principal #123, Cabarete, República Dominicana</p>
                    </div>
                </div>
            `
        });

        if (error) {
            console.error(error);
            return res.status(400).json({ error });
        }

        res.status(200).json({ message: 'Email sent successfully', data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
