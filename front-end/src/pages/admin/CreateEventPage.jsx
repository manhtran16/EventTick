import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "./CreateEventPage.css";
import {
  RegisterEventStep1,
  RegisterEventStep2,
  RegisterEventStep3,
  RegisterEventStep4,
} from "@/features/event-creation";
import { axiosInstance } from "@/services/apiClient";

const CreateEventPage = () => {
  const [stepOneData, setStepOneData] = useState({
    eventName: "",
    eventAddress: "",
    eventType: "offline",
    venueName: "",
    category: "Hội thảo & Workshop",
    eventDesc: "",
    organizerName: "",
    organizerInfo: "",
    eventImage: null,
    backgroundImage: null,
  });
  const [stepTwoData, setStepTwoData] = useState(null);
  const [stepThreeData, setStepThreeData] = useState(null);
  const [stepFourData, setStepFourData] = useState(null);

  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSave = (data) => {
    setStepOneData(data);
    setActiveStep(2);
  };

  const onSaveStep2 = (data) => {
    setStepTwoData(data);
    setActiveStep(3);
  };

  const onSaveStep3 = (data) => {
    setStepThreeData(data);
    setActiveStep(4);
  };

  const onSaveStep4 = async (data) => {
    setStepFourData(data);

    if (!stepOneData || !stepTwoData || !stepThreeData || !data) {
      alert("Hãy điền đủ thông tin trên");
      return;
    }

    setLoading(true);

    const cleanSessions = stepTwoData.map((session) => ({
      ...session,
      tickets: session.tickets.map((ticket) => ({
        name: ticket.name,
        price: ticket.price,
        quantity: ticket.quantity,
        minOrder: ticket.minOrder,
        desc: ticket.desc,
      })),
    }));

    const eventData = {
      ...stepOneData,
      sessions: cleanSessions,
      ...stepThreeData,
      paymentInfo: data,
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(eventData));
    // console.log(eventData);

    if (stepOneData.eventImage) {
      formData.append("eventImage", stepOneData.eventImage);
    }
    if (stepOneData.backgroundImage) {
      formData.append("backgroundImage", stepOneData.backgroundImage);
    }

    stepTwoData.forEach((session, sIdx) => {
      session.tickets.forEach((ticket, tIdx) => {
        if (ticket.image) {
          formData.append(`ticketImages_${sIdx}_${tIdx}`, ticket.image);
        }
      });
    });
    // for (let [key, value] of formData.entries()) {
    //   // console.log(key, value);
    // }

    try {
      await axiosInstance.post("/events", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      // notify user and redirect to My Events
      alert("Tạo sự kiện thành công! Sự kiện của bạn đang ở trạng thái 'Chờ Admin duyệt'.");
      navigate("/admin/my-events");
    } catch (err) {
      console.error("Error saving event:", err);
      setLoading(false); // hide loading if error
      alert("Có lỗi xảy ra khi tạo sự kiện.");
    }
  };

  const handleClick = (step) => {
    if (step === activeStep) {
      setActiveStep(step);
    }
  };

  return (
    <>
      <div className="steps-in-register">
        <div
          className={`step-btn ${activeStep === 1 ? "active" : ""}`}
          onClick={() => handleClick(1)}
        >
          Thông tin sự kiện
        </div>
        <div
          className={`step-btn ${activeStep === 2 ? "active" : ""}`}
          onClick={() => handleClick(2)}
        >
          Thời gian &amp; Loại vé
        </div>
        <div
          className={`step-btn ${activeStep === 3 ? "active" : ""}`}
          onClick={() => handleClick(3)}
        >
          Cài đặt
        </div>
        <div
          className={`step-btn ${activeStep === 4 ? "active" : ""}`}
          onClick={() => handleClick(4)}
        >
          Thông tin thanh toán
        </div>

        <Link to="/" className="event-create-close-btn ">
          ×
        </Link>
      </div>

      {loading && (
        <div className="loading-message">
          Đang tạo mới sự kiện, vui lòng chờ...
        </div>
      )}

      {activeStep === 1 && (
        <RegisterEventStep1 stepOneDataPassed={stepOneData} onSave={onSave} />
      )}
      {activeStep === 2 && <RegisterEventStep2 onSaveStep2={onSaveStep2} />}
      {activeStep === 3 && <RegisterEventStep3 onSaveStep3={onSaveStep3} />}
      {activeStep === 4 && <RegisterEventStep4 onSaveStep4={onSaveStep4} />}
    </>
  );
};

export default CreateEventPage;
