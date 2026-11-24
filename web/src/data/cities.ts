// Indian cities grouped by state / UT. Coordinates are city centres (approx.).
// Each also carries a suggested "hotspot" (an old-city core) the map opens on.
export interface City { id: string; name: string; hi: string; state: string; lat: number; lng: number; zoom?: number }

const c = (state: string, list: [string, string, number, number, number?][]): City[] =>
  list.map(([name, hi, lat, lng, zoom]) => ({ id: `${state}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, hi, state, lat, lng, zoom }));

export const CITIES: City[] = [
  ...c('Andhra Pradesh', [['Visakhapatnam', 'विशाखापत्तनम', 17.6868, 83.2185], ['Vijayawada', 'विजयवाड़ा', 16.5062, 80.648], ['Guntur', 'गुंटूर', 16.3067, 80.4365], ['Tirupati', 'तिरुपति', 13.6288, 79.4192]]),
  ...c('Assam', [['Guwahati', 'गुवाहाटी', 26.1445, 91.7362], ['Silchar', 'सिलचर', 24.8333, 92.7789]]),
  ...c('Bihar', [['Patna', 'पटना', 25.6093, 85.1376], ['Gaya', 'गया', 24.7914, 85.0002], ['Bhagalpur', 'भागलपुर', 25.2425, 86.9842], ['Muzaffarpur', 'मुज़फ़्फ़रपुर', 26.1209, 85.3647]]),
  ...c('Chandigarh', [['Chandigarh', 'चंडीगढ़', 30.7333, 76.7794]]),
  ...c('Chhattisgarh', [['Raipur', 'रायपुर', 21.2514, 81.6296], ['Bhilai', 'भिलाई', 21.1938, 81.3509]]),
  ...c('Delhi', [['Chandni Chowk', 'चांदनी चौक', 28.6562, 77.2300, 17], ['Karol Bagh', 'करोल बाग़', 28.6519, 77.1909, 17], ['Shahdara', 'शाहदरा', 28.6731, 77.2894], ['Connaught Place', 'कनॉट प्लेस', 28.6315, 77.2167]]),
  ...c('Goa', [['Panaji', 'पणजी', 15.4909, 73.8278]]),
  ...c('Gujarat', [['Ahmedabad', 'अहमदाबाद', 23.0225, 72.5714], ['Surat', 'सूरत', 21.1702, 72.8311], ['Vadodara', 'वडोदरा', 22.3072, 73.1812], ['Rajkot', 'राजकोट', 22.3039, 70.8022]]),
  ...c('Haryana', [['Gurugram', 'गुरुग्राम', 28.4595, 77.0266], ['Faridabad', 'फ़रीदाबाद', 28.4089, 77.3178], ['Panipat', 'पानीपत', 29.3909, 76.9635]]),
  ...c('Himachal Pradesh', [['Shimla', 'शिमला', 31.1048, 77.1734]]),
  ...c('Jammu & Kashmir', [['Srinagar', 'श्रीनगर', 34.0837, 74.7973], ['Jammu', 'जम्मू', 32.7266, 74.857]]),
  ...c('Jharkhand', [['Ranchi', 'रांची', 23.3441, 85.3096], ['Jamshedpur', 'जमशेदपुर', 22.8046, 86.2029], ['Dhanbad', 'धनबाद', 23.7957, 86.4304]]),
  ...c('Karnataka', [['Bengaluru', 'बेंगलुरु', 12.9716, 77.5946], ['Mysuru', 'मैसूरु', 12.2958, 76.6394], ['Hubballi', 'हुबली', 15.3647, 75.124], ['Mangaluru', 'मंगलुरु', 12.9141, 74.856]]),
  ...c('Kerala', [['Kochi', 'कोच्चि', 9.9312, 76.2673], ['Thiruvananthapuram', 'तिरुवनंतपुरम', 8.5241, 76.9366], ['Kozhikode', 'कोझिकोड', 11.2588, 75.7804]]),
  ...c('Madhya Pradesh', [['Indore', 'इंदौर', 22.7196, 75.8577], ['Bhopal', 'भोपाल', 23.2599, 77.4126], ['Jabalpur', 'जबलपुर', 23.1815, 79.9864], ['Gwalior', 'ग्वालियर', 26.2183, 78.1828]]),
  ...c('Maharashtra', [['Mumbai', 'मुंबई', 19.076, 72.8777], ['Dharavi', 'धारावी', 19.0405, 72.8543, 17], ['Pune', 'पुणे', 18.5204, 73.8567], ['Nagpur', 'नागपुर', 21.1458, 79.0882], ['Nashik', 'नाशिक', 19.9975, 73.7898], ['Aurangabad', 'औरंगाबाद', 19.8762, 75.3433]]),
  ...c('Odisha', [['Bhubaneswar', 'भुवनेश्वर', 20.2961, 85.8245], ['Cuttack', 'कटक', 20.4625, 85.8828]]),
  ...c('Punjab', [['Ludhiana', 'लुधियाना', 30.901, 75.8573], ['Amritsar', 'अमृतसर', 31.6200, 74.8765, 17], ['Jalandhar', 'जालंधर', 31.326, 75.5762]]),
  ...c('Rajasthan', [['Jaipur', 'जयपुर', 26.9239, 75.8267, 17], ['Jodhpur', 'जोधपुर', 26.2389, 73.0243], ['Udaipur', 'उदयपुर', 24.5854, 73.7125], ['Kota', 'कोटा', 25.2138, 75.8648]]),
  ...c('Tamil Nadu', [['Chennai', 'चेन्नई', 13.0827, 80.2707], ['Coimbatore', 'कोयंबटूर', 11.0168, 76.9558], ['Madurai', 'मदुरै', 9.9252, 78.1198], ['Tiruchirappalli', 'तिरुचिरापल्ली', 10.7905, 78.7047]]),
  ...c('Telangana', [['Hyderabad', 'हैदराबाद', 17.3616, 78.4747, 17], ['Warangal', 'वारंगल', 17.9689, 79.5941]]),
  ...c('Uttar Pradesh', [['Lucknow', 'लखनऊ', 26.8467, 80.9462], ['Kanpur', 'कानपुर', 26.4499, 80.3319], ['Varanasi', 'वाराणसी', 25.3109, 83.0107, 17], ['Agra', 'आगरा', 27.1767, 78.0081], ['Prayagraj', 'प्रयागराज', 25.4358, 81.8463], ['Ghaziabad', 'ग़ाज़ियाबाद', 28.6692, 77.4538], ['Noida', 'नोएडा', 28.5355, 77.391], ['Meerut', 'मेरठ', 28.9845, 77.7064]]),
  ...c('Uttarakhand', [['Dehradun', 'देहरादून', 30.3165, 78.0322], ['Haridwar', 'हरिद्वार', 29.9457, 78.1642]]),
  ...c('West Bengal', [['Kolkata', 'कोलकाता', 22.5726, 88.3639], ['Howrah', 'हावड़ा', 22.5958, 88.2636], ['Siliguri', 'सिलीगुड़ी', 26.7271, 88.3953], ['Durgapur', 'दुर्गापुर', 23.5204, 87.3119]]),
];

export const STATES = [...new Set(CITIES.map((c) => c.state))];
