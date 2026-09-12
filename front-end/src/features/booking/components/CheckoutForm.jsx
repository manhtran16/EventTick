import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useState } from "react";
import "./CheckoutForm.css";
const CheckoutForm = ({ stopTimer, orderId }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return; // Stripe.js has not yet loaded
    }

    setLoading(true);
    setErrorMessage(null);
    stopTimer();

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `http://localhost:5173/payment-result/${orderId}`,
      },
    });

    if (error) {
      // Show error to your customer
      setErrorMessage(error.message);
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button className="payment-page-button" disabled={!stripe || loading}>
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
    </form>
  );
};

export default CheckoutForm;
