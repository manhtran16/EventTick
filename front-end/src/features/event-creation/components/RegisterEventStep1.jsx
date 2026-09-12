import { useState } from "react";
import "./RegisterEventStep1.css";

const RegisterEventStep1 = ({ stepOneDataPassed, onSave }) => {
  const initialData = stepOneDataPassed || {
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
  };

  const [stepOneData, setStepOneData] = useState(initialData);

  const handleChange = (e) => {
    const { id, value, name, type, files } = e.target;
    if (type === "radio") {
      setStepOneData({ ...stepOneData, eventType: value });
    } else if (type === "file") {
      setStepOneData({ ...stepOneData, [id]: files[0] });
    } else {
      setStepOneData({ ...stepOneData, [id || name]: value });
    }
  };

  const handleSave = () => {
    const isIncomplete = Object.values(stepOneData).some(
      (val) => val === "" || val === null,
    );

    if (isIncomplete) {
      alert("Hãy điền đủ thông tin trên");
      return;
    }

    if (onSave) {
      onSave(stepOneData);
    }
  };

  return (
    <div className="step-one-main">
      <div className="step-one-content">
        <h3>Thông tin sự kiện</h3>
        <div className="step-one-upload-section">
          <label>
            Thêm ảnh sự kiện để hiển thị ở các vị trí khác (720x958)
          </label>
          <input
            type="file"
            id="eventImage"
            accept="image/*"
            onChange={handleChange}
          />
          <label>Thêm ảnh nền sự kiện (1280x720)</label>
          <input
            type="file"
            id="backgroundImage"
            accept="image/*"
            onChange={handleChange}
          />
        </div>

        <div className="step-one-form-group">
          <label htmlFor="eventName">Tên sự kiện</label>
          <input
            type="text"
            id="eventName"
            placeholder="Nhập tên sự kiện"
            value={stepOneData.eventName}
            onChange={handleChange}
          />
        </div>

        <div className="step-one-form-group">
          <label htmlFor="eventAddress">Địa chỉ sự kiện</label>
          <input
            type="text"
            id="eventAddress"
            placeholder="Nhập địa chỉ"
            value={stepOneData.eventAddress}
            onChange={handleChange}
          />
        </div>

        <div className="step-one-event-type">
          <label>
            <input
              type="radio"
              name="event-type"
              value="offline"
              checked={stepOneData.eventType === "offline"}
              onChange={handleChange}
            />{" "}
            Sự kiện Offline
          </label>
          <label>
            <input
              type="radio"
              name="event-type"
              value="online"
              checked={stepOneData.eventType === "online"}
              onChange={handleChange}
            />{" "}
            Sự kiện Online
          </label>
        </div>

        <div className="step-one-form-group">
          <label htmlFor="venueName">Tên địa điểm</label>
          <input
            type="text"
            id="venueName"
            placeholder="Nhập tên địa điểm"
            value={stepOneData.venueName}
            onChange={handleChange}
          />
        </div>

        <div className="step-one-form-group">
          <label htmlFor="category">Danh mục sự kiện</label>
          <select
            id="category"
            value={stepOneData.category}
            onChange={handleChange}
          >
            <option>Nhạc sống & Concert</option>
            <option>Sân khấu & Nghệ thuật</option>
            <option>Thể Thao</option>
            <option>Hội thảo & Workshop</option>
            <option>Tham quan & Trải nghiệm</option>
            <option>Khác</option>
          </select>
        </div>

        <div className="step-one-form-group">
          <label htmlFor="eventDesc">Thông tin sự kiện</label>
          <textarea
            id="eventDesc"
            rows={4}
            placeholder="[Tóm tắt ngắn gọn về sự kiện...]"
            value={stepOneData.eventDesc}
            onChange={handleChange}
          />
        </div>

        <div className="step-one-form-group">
          <label htmlFor="organizerName">Tên ban tổ chức</label>
          <input
            type="text"
            id="organizerName"
            placeholder="Nhập tên ban tổ chức"
            value={stepOneData.organizerName}
            onChange={handleChange}
          />
        </div>

        <div className="step-one-form-group">
          <label htmlFor="organizerInfo">Thông tin ban tổ chức</label>
          <input
            type="text"
            id="organizerInfo"
            placeholder="Nhập Thông tin ban tổ chức"
            value={stepOneData.organizerInfo}
            onChange={handleChange}
          />
        </div>

        <div
          className="next-step-btn"
          onClick={handleSave}
        >
          Tiếp tục
        </div>
      </div>
    </div>
  );
};

export default RegisterEventStep1;
