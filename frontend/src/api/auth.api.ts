import axiosInstance from "./axiosInstance";

interface RegisterData {
    email?: string;
    username?: string;
    password?: string;
}

interface LoginData {
    email?: string;
    password?: string;
}

interface AuthResponse {
    token: string;
    refreshToken?: string;
    user?: {
        id: string;
        name: string;
        email: string;
        balance?: number;
    };
}

export const registerUser = async (userData: RegisterData): Promise<AuthResponse> => {
    try {
        const response = await axiosInstance.post<AuthResponse>('/auth/register', userData);
        const { token, refreshToken } = response.data;
        
        if (token) {
            localStorage.setItem('authToken', token);
        }
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
        
        return response.data;
    } catch (error: any) {
        console.error("Registration failed:", error.response?.data);
        throw error.response?.data || new Error("Registration failed");
    }
};

export const loginUser = async (credentials: LoginData): Promise<AuthResponse> => {
    try {
        const response = await axiosInstance.post<AuthResponse>('/auth/login', credentials);
        const { token, refreshToken } = response.data;

        if (token) {
            localStorage.setItem('authToken', token);
        }
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
        
        return response.data;
    } catch (error: any) {
        console.error("Login failed: ", error.response?.data);
        throw error.response?.data || new Error("Login failed");
    }
};

export const logoutUser = async (): Promise<void> => {
    try {
        await axiosInstance.post('/auth/logout', {});
    } catch (error: any) {
        console.error("Logout failed:", error.response?.data);
    } finally {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
    }
};