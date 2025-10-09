import { Response } from "express";

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T | null;
  errors?: any;
  error?: any;
  stack?: string;
}

export const OK = (
  res: Response,
  data: any = null,
  message = "Success",
  statusCode = 200
) => {
  const response: ApiResponse = { success: true, message, data };
  return res.status(statusCode).json(response);
};

export const CREATED = (res: Response, data: any = null) => {
  const response: ApiResponse = { success: true, message: "Success", data };
  return res.status(201).json(response);
};

export const BADREQUEST = (res: Response, message = "Bad request") => {
  console.error("****ERROR-BAD-REQUEST**** :->", message);
  const response: ApiResponse = { success: false, message, data: null };
  return res.status(400).json(response);
};

export const UNAUTHORIZED = (res: Response, message = "Unauthorized") => {
  const response: ApiResponse = { success: false, message, data: null };
  return res.status(401).json(response);
};

export const FORBIDDEN = (res: Response, message = "Forbidden") => {
  const response: ApiResponse = { success: false, message, data: null };
  return res.status(403).json(response);
};

export const NOT_FOUND = (res: Response, message = "Not found") => {
  const response: ApiResponse = { success: false, message, data: null };
  return res.status(404).json(response);
};

export const CONFLICT = (res: Response, message = "Conflict") => {
  const response: ApiResponse = { success: false, message, data: null };
  return res.status(409).json(response);
};

export const INVALID = (res: Response, errors: any) => {
  const response: ApiResponse = {
    success: false,
    message: "Invalid",
    errors,
    data: null,
  };
  return res.status(422).json(response);
};

export const INTERNAL_SERVER_ERROR = (res: Response, error: any = "Error") => {
  console.error("****ERROR-INTERNAL**** :->", error);
  const response: ApiResponse = {
    success: false,
    message: "Internal Server Error",
    error: process.env.ENV === "DEV" ? error.message || error : undefined,
    stack: process.env.ENV === "DEV" && error.stack ? error.stack : undefined,
    data: null,
  };
  return res.status(500).json(response);
};
