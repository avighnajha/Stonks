import axiosInstance from "./axiosInstance";

interface RegisterData {
    email?: string;
    username?: string;
    password?: string;
}

interface LoginData {
    email?:string;
    password?: string;
}

export const registerUser = async (userData: RegisterData) => {
    try {
        const response = await axiosInstance.post('/auth/register', userData);
        return response.data;
    } catch (error) {
        console.error("Registration failed:", error.response?.data);
        throw error.response?.data || new Error("Registration failed");
    }
}

export const loginUser = async (credentials: LoginData)=> {
    try{
        const response = await axiosInstance.post('/auth/login', credentials)

        const {token} = response.data;

        if (token) {
            localStorage.setItem
            ('authToken', token);
        }
        return token;
    } catch (error) {
        console.error("Login failed: ", error.register?.data);
        throw error.response?.data || new Error("Login failed");
    }
}