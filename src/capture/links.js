import {normaliseLink,httpUrl} from '../utils/urls.js';
export function allowedLink(raw,base,{includeSubdomains=false}={}){const value=normaliseLink(raw,base);if(!value)return null;const start=httpUrl(base),u=httpUrl(value);return u.hostname===start.hostname||(includeSubdomains&&u.hostname.endsWith(`.${start.hostname}`))?value:null}
