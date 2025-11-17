import axios from "axios"
import join from "url-join"
import {
    apiUrl,
    NOT_CONNECT_NETWORK,
    NETWORK_CONNECTION_MESSAGE,
    key
} from "../constance/constance.js"
import Swal from 'sweetalert2';

const isAbsoluteURLRegex = /^(?:w+:)\/\//

axios.interceptors.request.use(async (config) => {
    if(!isAbsoluteURLRegex.test(config.url)){
        config.url = join(apiUrl, config.url)
    }
    
    // Add token to Authorization header if available
    const token = localStorage.getItem(key.TOKEN);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    config.timeout = 0; // 0 Second
    return config
})

axios.interceptors.response.use(
    (response) =>{
        return response
    },
    (error) => {
        console.log(JSON.stringify(error, undefined, 2))
        if(axios.isCancel(error)){
            return Promise.reject(error)
        }else if(!error.response){
            Swal.fire({
                icon: 'error',
                title: `Error Connection`,
                text: NETWORK_CONNECTION_MESSAGE,
                timer: 3000,
                timerProgressBar: true,
            })
            return Promise.reject({
                code: NOT_CONNECT_NETWORK,
                message: NETWORK_CONNECTION_MESSAGE,
            })
        }
        console.log(error)
        console.log(error.response.data)
        console.log(error.response.data?.result?.message)
        console.log(error.status)
        

        const statusServer = error.status
        const result = error.response?.data?.result;
        const message = (typeof result === 'string' ? result : result?.message) ||error.response?.data?.message ||'An unexpected error occurred.';
        const { status } = error.response;

        if(statusServer === 403){
          window.location.replace("/access-denied");
        } else if(statusServer === 401) {
          window.location.replace("/login");
        } else {
            Swal.fire({
                icon: 'info',
                title: `Try Again`,
                // title: `Status ${status}`,
                text: message,
                timer: 5000,
                timerProgressBar: true,
            });
          }
        
        
        return Promise.reject(error)
    }
)
export const httpClient = axios;
