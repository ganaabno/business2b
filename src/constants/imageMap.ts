// src/constants/imageMap.ts
import Sanya from "../assets/tours/Sanya.jpg";
import Singapore from "../assets/tours/Singapore.jpg";
import Phuquoc from "../assets/tours/Phuquoc.jpg";
import Bangkok from "../assets/tours/Bangkok.jpg";
import ThailandPucket from "../assets/tours/ThailandPucket.jpg";
import Japan from "../assets/tours/Japan.jpg";
import NhaTrang from "../assets/tours/NhaTrang.jpg";
import Bali from "../assets/tours/Bali.jpg";
import Turkey from "../assets/tours/Turkey.jpg";
import Dalian from "../assets/tours/Dalian.jpg";
import HaLongBay from "../assets/tours/HaLongBay.jpg";
import Shanghai from "../assets/tours/Shanghai.jpg";
import Zhangjiajie from "../assets/tours/Zhangjiajie.jpg";
import DefaultImage from "../assets/tours/default.jpg";

export const IMAGE_MAP = {
  "Hainan Island": Sanya,
  Singapore: Singapore,
  "Ho Chi Minh - Phu Quoc": Phuquoc,
  "Thailand - Bangkok": Bangkok,
  "Thailand - Phuket": ThailandPucket,
  Japan: Japan,
  "Phu Quoc": Phuquoc,
  "Nha Trang": NhaTrang,
  Bali: Bali,
  Turkey: Turkey,
  Dalian: Dalian,
  "Ha Long Bay": HaLongBay,
  "Shanghai - Huzhou - Hangzhou": Shanghai,
  Zhangjiajie: Zhangjiajie,
} as const;

export const DEFAULT_IMAGE = DefaultImage;
