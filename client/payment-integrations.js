// ============================================
// PAYMENT GATEWAY INTEGRATIONS - READY FOR CREDENTIALS
// ============================================

/**
 * AZUL DOMINICANA PAYMENT INTEGRATION
 * 
 * Para activar esta integración necesitas:
 * 1. Merchant ID (proporcionado por Azul)
 * 2. Auth Key / Certificate (proporcionado por Azul)
 * 3. URL de la pasarela (producción o pruebas)
 * 
 * Documentación: https://azul.com.do/desarrolladores
 */

const AZUL_CONFIG = {
    // COMPLETAR CUANDO TENGAS LAS CREDENCIALES
    merchantId: 'TU_MERCHANT_ID_AQUI',
    merchantName: 'Villas Maribella',
    merchantType: 'eCommerce',
    // URL de producción: https://pagos.azul.com.do/webpayment/
    // URL de pruebas: https://pruebas.azul.com.do/webpayment/
    gatewayUrl: 'https://pruebas.azul.com.do/webpayment/default.aspx',
    returnUrl: window.location.origin + '/payment-success.html',
    cancelUrl: window.location.origin + '/payment-cancel.html'
};

function processAzulPayment(amount, orderId, customerData) {
    // Construir formulario de pago para Azul
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = AZUL_CONFIG.gatewayUrl;

    const params = {
        MerchantId: AZUL_CONFIG.merchantId,
        MerchantName: AZUL_CONFIG.merchantName,
        MerchantType: AZUL_CONFIG.merchantType,
        OrderNumber: orderId,
        Amount: amount.toFixed(2),
        ITBIS: '0.00',
        ApprovedUrl: AZUL_CONFIG.returnUrl,
        DeclinedUrl: AZUL_CONFIG.cancelUrl,
        CancelUrl: AZUL_CONFIG.cancelUrl,
        UseCustomField1: '0',
        CustomField1Label: '',
        CustomField1Value: '',
    };

    for (const [key, value] of Object.entries(params)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    }

    // Agregar al DOM y enviar
    document.body.appendChild(form);
    form.submit();
}

/**
 * PAYPAL INTEGRATION
 * 
 * Para activar esta integración necesitas:
 * 1. Crear cuenta PayPal Business
 * 2. Obtener Client ID desde: https://developer.paypal.com/dashboard/
 * 3. Agregar el SDK de PayPal al HTML:
 *    <script src="https://www.paypal.com/sdk/js?client-id=TU_CLIENT_ID&currency=USD"></script>
 * 
 * Documentación: https://developer.paypal.com/docs/checkout/
 */

const PAYPAL_CONFIG = {
    // COMPLETAR CUANDO TENGAS EL CLIENT ID
    clientId: 'TU_PAYPAL_CLIENT_ID_AQUI',
    currency: 'USD',
    // Usar 'sandbox' para pruebas, 'production' para producción
    environment: 'sandbox'
};

function initPayPalButton(amount, orderId, onSuccess) {
    // Verificar que el SDK de PayPal esté cargado
    if (typeof paypal === 'undefined') {
        console.error('PayPal SDK no está cargado. Agrega el script al HTML.');
        showNotification('Error', 'PayPal no está configurado. Por favor contacta al administrador.', true);
        return;
    }

    // Renderizar botón de PayPal
    paypal.Buttons({
        style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal'
        },
        createOrder: function (data, actions) {
            return actions.order.create({
                purchase_units: [{
                    description: `Reserva Villas Maribella - ${orderId}`,
                    amount: {
                        currency_code: PAYPAL_CONFIG.currency,
                        value: amount.toFixed(2)
                    }
                }]
            });
        },
        onApprove: async function (data, actions) {
            // Capturar el pago
            const order = await actions.order.capture();
            console.log('Pago capturado:', order);

            // Llamar callback de éxito
            if (onSuccess) {
                onSuccess(order);
            }
        },
        onError: function (err) {
            console.error('Error en PayPal:', err);
            showNotification('Error de Pago', 'Hubo un problema procesando el pago con PayPal. Por favor intenta de nuevo.', true);
        },
        onCancel: function (data) {
            console.log('Pago cancelado por el usuario');
            showNotification('Pago Cancelado', 'Has cancelado el pago. Puedes intentar de nuevo cuando estés listo.', true);
        }
    }).render('#paypal-button-container');
}

// ============================================
// INSTRUCCIONES DE USO
// ============================================

/*
PARA ACTIVAR AZUL DOMINICANA:
1. Reemplaza 'TU_MERCHANT_ID_AQUI' con tu Merchant ID real
2. Configura las URLs de retorno (returnUrl, cancelUrl)
3. En processPayment('card'), llama a processAzulPayment()

PARA ACTIVAR PAYPAL:
1. Agrega al index.html antes de </body>:
   <script src="https://www.paypal.com/sdk/js?client-id=TU_CLIENT_ID&currency=USD"></script>
2. Reemplaza 'TU_PAYPAL_CLIENT_ID_AQUI' con tu Client ID real
3. En processPayment('paypal'), llama a initPayPalButton()
4. Agrega un div en el modal: <div id="paypal-button-container"></div>

EJEMPLO DE IMPLEMENTACIÓN:
function processPayment(method) {
    if (method === 'transfer') {
        showTransferDetails();
        return;
    }
    if (method === 'card') {
        const orderId = 'VM-' + Date.now();
        const amount = calculateTotal(); // Tu función de cálculo
        processAzulPayment(amount, orderId, getCustomerData());
        return;
    }
    if (method === 'paypal') {
        const amount = calculateTotal();
        const orderId = 'VM-' + Date.now();
        initPayPalButton(amount, orderId, handlePayPalSuccess);
        return;
    }
}
*/
