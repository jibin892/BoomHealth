import axios from "axios"

import { getApiBaseUrl } from "@/lib/api/config"

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
})
