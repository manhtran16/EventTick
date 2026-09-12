import { useState } from "react";

const CartItem = ({
  id,
  ticketName,
  ticketProp,
  ticketPrice,
  quantity,
  onDelete,
  onQuantityChange,
}) => {
  const total = quantity * ticketPrice;

  return (
    <tr>
      <td>{ticketProp}</td>
      <td>{ticketName}</td>
      <td>{ticketPrice.toLocaleString()} ₫</td>
      <td>
        <button
          className="real-time-event-button minus"
          onClick={() => onQuantityChange(id, Math.max(quantity - 1, 0))}
        >
          -
        </button>
        <span style={{ margin: "0 8px" }}>{quantity}</span>
        <button
          className="real-time-event-button plus"
          onClick={() => onQuantityChange(id, quantity + 1)}
        >
          +
        </button>
      </td>
      <td>{total.toLocaleString()} ₫</td>
      <td>
        <button
          className="real-time-event-button-delete-btn"
          onClick={() => {
            onQuantityChange(id, 0);
            onDelete();
          }}
        >
          Xóa
        </button>
      </td>
    </tr>
  );
};

export default CartItem;
