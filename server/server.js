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
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <div style="background-color: #00B4D8; padding: 30px; text-align: center; color: white;">
                        <!-- ESPACIO PARA LOGO: Reemplazar URL cuando el sitio esté en vivo -->
                        <img src="https://raw.githubusercontent.com/Drim0717/Villas-Maribella/main/images/Logo.png" alt="Villas Maribella" style="width: 150px; margin-bottom: 15px; filter: brightness(0) invert(1);">
                        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">¡Reserva Confirmada!</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #ffffff;">
                        <p style="font-size: 16px;">Hola <strong>${guestName}</strong>,</p>
                        <p style="line-height: 1.6;">Estamos encantados de confirmar tu estadía en <strong>Villas Maribella</strong>. Hemos preparado todo para que disfrutes de una experiencia inolvidable.</p>
                        
                        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 10px; border-left: 5px solid #0077B6; margin: 25px 0;">
                            <h3 style="color: #0077B6; margin-top: 0; border-bottom: 1px solid #d0e7f9; padding-bottom: 10px;">Detalles de la Estadía</h3>
                            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                                <tr><td style="padding: 5px 0;"><strong>Código:</strong></td><td>${reservationId}</td></tr>
                                <tr><td style="padding: 5px 0;"><strong>Villa:</strong></td><td>#${villaNumber}</td></tr>
                                <tr><td style="padding: 5px 0;"><strong>Check-in:</strong></td><td>${checkIn}</td></tr>
                                <tr><td style="padding: 5px 0;"><strong>Check-out:</strong></td><td>${checkOut}</td></tr>
                                <tr><td style="padding: 5px 0; color: #0077B6; font-size: 16px;"><strong>Total:</strong></td><td style="color: #0077B6; font-size: 16px;"><strong>$${total}</strong></td></tr>
                            </table>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://maps.app.goo.gl/wWEZfYFCeQ6XYGtv7" style="background-color: #0077B6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">📍 ¿Cómo llegar? Ver en Mapas</a>
                        </div>

                        <p style="margin-top: 30px; font-size: 14px; color: #666; line-height: 1.6;">Si necesitas ayuda adicional o tienes alguna petición especial, no dudes en responder a este correo.</p>
                        <p style="margin-top: 20px; font-weight: bold;">¡Te esperamos pronto!</p>
                    </div>

                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                        <p style="font-size: 12px; color: #999; margin: 0;">Villas Maribella - Cabarete, República Dominicana</p>
                        <p style="font-size: 11px; color: #bbb; margin-top: 5px;">Calle Principal #123. <a href="https://maps.app.goo.gl/wWEZfYFCeQ6XYGtv7" style="color: #aaa; text-decoration: underline;">Ver Ubicación</a></p>
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
