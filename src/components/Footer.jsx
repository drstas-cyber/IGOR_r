import React from 'react';
import { Link } from 'react-router-dom';
import { trackSearchHomesClick } from '@/lib/tracking';
import { GOOGLE_RATING, GOOGLE_REVIEW_COUNT, GOOGLE_REVIEWS_URL } from '@/lib/reviews';

// Outbound MLS search (ApexIDX). New tab; rel="noopener" only (no noreferrer).
const APEX_SEARCH_FOOTER_URL =
  'https://apexidx.com/idx_lite/advancedsearch/EN_LA?utm_source=tvh&utm_medium=referral&utm_campaign=search_homes&utm_content=footer';

const FACEBOOK_URL = 'https://www.facebook.com/GeorgeKHomes/';
const YELP_URL = 'https://www.yelp.com/biz/george-khazanovskiy-temecula';

// Standard Facebook "f" mark (widely-used public icon path).
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 1.888-.287 1.779h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

// Standard 4-color Google "G" mark.
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M23.766 12.276c0-.818-.074-1.606-.212-2.363H12.24v4.47h6.482a5.54 5.54 0 0 1-2.4 3.633v3.02h3.887c2.276-2.096 3.557-5.184 3.557-8.76z" />
      <path fill="#34A853" d="M12.24 24c3.24 0 5.956-1.075 7.942-2.908l-3.887-3.02c-1.078.724-2.46 1.15-4.055 1.15-3.117 0-5.756-2.104-6.698-4.93H1.53v3.11A11.997 11.997 0 0 0 12.24 24z" />
      <path fill="#FBBC05" d="M5.542 14.293a7.2 7.2 0 0 1-.375-2.293c0-.796.137-1.57.375-2.293V6.597H1.53A11.997 11.997 0 0 0 .24 12c0 1.936.463 3.767 1.29 5.403l4.012-3.11z" />
      <path fill="#EA4335" d="M12.24 4.773c1.763 0 3.346.606 4.59 1.796l3.444-3.444C18.192 1.19 15.476 0 12.24 0 7.56 0 3.51 2.69 1.53 6.597l4.012 3.11c.942-2.826 3.581-4.934 6.698-4.934z" />
    </svg>
  );
}

// Official Yelp burst mark (Simple Icons canonical single-color glyph,
// fetched verbatim from simple-icons/simple-icons — not hand-drawn).
function YelpIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#D32323" aria-hidden="true" {...props}>
      <path d="m7.6885 15.1415-3.6715.8483c-.3769.0871-.755.183-1.1452.155-.2611-.0188-.5122-.0414-.7606-.213a1.179 1.179 0 0 1-.331-.3594c-.3486-.5519-.3656-1.3661-.3697-2.0004a6.2874 6.2874 0 0 1 .3314-2.0642 1.857 1.857 0 0 1 .1073-.2474 2.3426 2.3426 0 0 1 .1255-.2165 2.4572 2.4572 0 0 1 .1563-.1975 1.1736 1.1736 0 0 1 .399-.2831 1.082 1.082 0 0 1 .4592-.0837c.2355.0016.5139.052.91.1734.0555.0191.1237.0382.1856.0572.3277.1013.7048.2404 1.1499.3987.6863.2404 1.3663.487 2.0463.7397l1.2117.4423c.2217.0807.4363.18.6412.297.174.0984.3273.2298.4512.387a1.217 1.217 0 0 1 .192.4309 1.2205 1.2205 0 0 1-.872 1.4522c-.0468.0151-.0852.0239-.1085.0293l-1.105.2553-.0031-.001zM18.8208 7.565a1.8506 1.8506 0 0 0-.2042-.1754 2.4082 2.4082 0 0 0-.2077-.1394 2.3607 2.3607 0 0 0-.2269-.109 1.1705 1.1705 0 0 0-.482-.0796 1.0862 1.0862 0 0 0-.4498.1263c-.2107.1048-.4388.2732-.742.5551-.042.0417-.0947.0886-.142.133-.2502.2351-.5286.5252-.8599.863a114.6363 114.6363 0 0 0-1.5166 1.5629l-.8962.9293a4.1897 4.1897 0 0 0-.4466.5483 1.541 1.541 0 0 0-.2364.5459 1.2199 1.2199 0 0 0 .0107.4518l.0046.02a1.218 1.218 0 0 0 1.4184.923 1.162 1.162 0 0 0 .1105-.0213l4.7781-1.104c.3766-.087.7587-.1667 1.097-.3631.2269-.1316.4428-.262.5909-.5252a1.1793 1.1793 0 0 0 .1405-.4683c.0733-.6512-.2668-1.3908-.5403-1.963a6.2792 6.2792 0 0 0-1.2001-1.7103zM8.9703.0754a8.6724 8.6724 0 0 0-.83.1564c-.2754.066-.548.1383-.8146.2236-.868.2844-2.0884.8063-2.295 1.8065-.1165.5655.1595 1.1439.3737 1.66.2595.6254.614 1.1889.9373 1.7777.8543 1.5545 1.7245 3.0993 2.5922 4.6457.259.4617.5416 1.0464 1.043 1.2856a1.058 1.058 0 0 0 .1013.0383c.2248.0851.4699.1016.7041.0471a4.3015 4.3015 0 0 0 .0418-.0097 1.2136 1.2136 0 0 0 .5658-.3397 1.1033 1.1033 0 0 0 .079-.0822c.3463-.435.3454-1.0833.3764-1.6134.1042-1.771.2139-3.5423.3009-5.3142.0332-.6712.1055-1.3333.0655-2.0096-.0328-.5579-.0368-1.1984-.3891-1.6563-.6218-.8073-1.9476-.741-2.8523-.6158zm2.084 15.9505a1.1053 1.1053 0 0 0-1.2306-.4145 1.1398 1.1398 0 0 0-.1526.0633 1.4806 1.4806 0 0 0-.2171.1354c-.1992.1475-.3668.3392-.5196.5315-.0386.049-.074.1143-.12.1562l-.7686 1.0573a113.9168 113.9168 0 0 0-1.2913 1.789c-.278.3895-.5184.7184-.7083 1.0094-.036.0547-.0734.116-.1075.1647-.2277.3522-.3566.6092-.4228.8381a1.0945 1.0945 0 0 0-.046.4721c.0211.1655.0768.3246.1635.467.046.0715.0957.1406.1487.207a2.334 2.334 0 0 0 .1754.1825 1.843 1.843 0 0 0 .2108.1732c.5304.369 1.1112.6342 1.722.8391a6.0958 6.0958 0 0 0 1.5716.3004c.091.0046.1821.0025.2728-.006a2.3878 2.3878 0 0 0 .2506-.0351 2.3862 2.3862 0 0 0 .2447-.071 1.1927 1.1927 0 0 0 .4175-.2658c.1127-.113.1994-.249.2541-.3989.0889-.2214.1473-.5026.1857-.92.0034-.0593.0118-.1305.0177-.1958.0304-.3463.0443-.7531.0666-1.2315.0375-.7357.067-1.4681.0903-2.2026 0 0 .0495-1.3053.0494-1.306.0113-.3008.002-.6342-.0814-.9336a1.396 1.396 0 0 0-.1756-.4054zm8.6754 2.0439c-.1605-.176-.3878-.3514-.7462-.5682-.0518-.0288-.1124-.0674-.1684-.1009-.2985-.1795-.658-.3684-1.078-.5965a120.7615 120.7615 0 0 0-1.9427-1.042l-1.1515-.6107c-.0597-.0175-.1203-.0607-.1766-.0878-.2212-.1058-.4558-.2045-.6992-.2498a1.4915 1.4915 0 0 0-.2545-.0265 1.1527 1.1527 0 0 0-.1648.01 1.1077 1.1077 0 0 0-.9227.9133 1.4186 1.4186 0 0 0 .0159.439c.0563.3065.1932.6096.3346.875l.615 1.1526c.3422.65.6884 1.2963 1.0435 1.9406.229.4202.4196.7799.5982 1.078.0338.056.0721.1163.1011.1682.2173.3584.392.584.569.7458.1146.1107.252.195.4026.247.1583.0525.326.071.4919.0546a2.368 2.368 0 0 0 .251-.0435c.0817-.022.1622-.048.241-.0784a1.863 1.863 0 0 0 .2475-.1143 6.1018 6.1018 0 0 0 1.2818-.9597c.4596-.4522.8659-.9454 1.182-1.51.044-.08.0819-.163.1138-.2483a2.49 2.49 0 0 0 .0773-.2411c.0186-.083.033-.1669.0429-.2513a1.188 1.188 0 0 0-.0565-.491 1.0933 1.0933 0 0 0-.248-.4041zm2.86 3.742a.8523.8523 0 0 1-.111.4236c-.074.132-.178.2377-.3115.3172a.8428.8428 0 0 1-.4385.119.847.847 0 0 1-.4373-.1179.8526.8526 0 0 1-.3125-.3171.8548.8548 0 0 1-.111-.4248c0-.1526.038-.2958.1143-.4294a.8405.8405 0 0 1 .315-.3159.849.849 0 0 1 .4315-.1156.8514.8514 0 0 1 .4294.1144.84.84 0 0 1 .316.3148.8494.8494 0 0 1 .1156.4317zm-.1202 0c0-.1328-.0332-.256-.0996-.3698s-.1564-.2038-.2702-.2702a.7125.7125 0 0 0-.371-.1007.7204.7204 0 0 0-.3698.0996.7487.7487 0 0 0-.2713.2702.7181.7181 0 0 0-.0996.3709c0 .132.0332.2557.0996.371a.7355.7355 0 0 0 .2713.2713.7354.7354 0 0 0 .3698.0985.7205.7205 0 0 0 .3698-.0996.7423.7423 0 0 0 .2702-.2691.7186.7186 0 0 0 .1008-.3721zm-.577.0584.2724.4522h-.1922l-.237-.4052h-.1546v.4052h-.1695v-1.02h.2988c.1268 0 .2195.0247.2783.0744.0595.0496.0892.1252.0892.2267a.2785.2785 0 0 1-.0492.1625c-.032.0466-.0775.0813-.1362.1042zm-.0412-.1408a.1532.1532 0 0 0 .056-.1214c0-.0573-.0164-.0981-.0491-.1225-.0329-.0251-.0847-.0377-.1557-.0377h-.1214v.3285h.1237c.061 0 .1098-.0157.1465-.047z" />
    </svg>
  );
}

// Standard Equal Housing Opportunity pictogram: house silhouette with an
// equals-sign cutout. The two bars use the footer's own background color so
// they read as a cutout against the house shape, not a filled rectangle.
function EHOIcon(props) {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M24 3 3 21h6v22h12V29h6v14h12V21h6L24 3z" />
      <rect x="15" y="25" width="18" height="3.4" fill="#0D2E3A" />
      <rect x="15" y="32" width="18" height="3.4" fill="#0D2E3A" />
    </svg>
  );
}

export default function Footer() {
  const linkClasses = "block font-sans text-[14px] sm:text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors duration-300 py-1 sm:py-0";
  const headingClasses = "font-sans text-[14px] text-white font-bold mb-6 uppercase tracking-wider";
  const socialLinkClasses = "text-gray-300 hover:text-[#C8920A] transition-colors duration-300";

  return (
    <footer className="bg-[#0D2E3A] text-white pb-[70px] md:pb-0">
      {/* Main Footer Content */}
      <div className="py-[50px] px-[24px] md:px-[60px] max-w-7xl mx-auto">
        <div className="bg-[#C8920A] rounded-lg p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-[24px] text-[#12202A] font-bold">Ready to Make Your Move?</h3>
            <p className="font-sans text-[14px] text-[#12202A]">Free consultation. No obligation. Available 7 days a week.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="tel:6192772766" className="bg-[#12202A] hover:bg-[#1a3a4a] text-white font-bold py-4 px-8 rounded-lg text-[16px] transition-colors whitespace-nowrap text-center">
              Call (619) 277-2766
            </a>
            <Link to="/contact/" className="bg-white hover:bg-gray-100 text-[#12202A] font-bold py-4 px-8 rounded-lg text-[16px] transition-colors whitespace-nowrap text-center">
              Free Buyer Consultation
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 lg:gap-[80px]">

          {/* Column 1: Brand */}
          <div className="flex flex-col space-y-4">
            <h2 className="font-serif text-[24px] text-white font-bold">
              Temecula Valley Homes
            </h2>
            <p className="font-sans text-[13px] text-[#C8920A] font-semibold">
              George Khazanovskiy, Realtor® · DRE #02034120 · Allison James Estates &amp; Homes
            </p>
            <p className="font-sans text-[13px] text-gray-300 leading-[1.6]">
              Expert Real Estate Services in Temecula Valley. Dedicated to your long-term real estate success with George Khazanovskiy.
            </p>
            <div className="pt-2 flex flex-col space-y-2">
              <a href="tel:6192772766" className="font-sans text-[13px] text-[#C8920A] font-bold hover:text-white transition-colors">
                📞 619-277-2766
              </a>
              <a href="mailto:askgeorgek@gmail.com" className="font-sans text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors">
                askgeorgek@gmail.com
              </a>
              <a href="https://maps.google.com/?q=30777+Rancho+California+Rd,+Temecula,+CA+92592" target="_blank" rel="noopener noreferrer" className="font-sans text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors">
                📍 30777 Rancho California Rd, Temecula, CA 92592
              </a>
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors"
              >
                <span className="text-[#C8920A]">★</span> {GOOGLE_RATING} · Read our {GOOGLE_REVIEW_COUNT} Google reviews
              </a>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="George Khazanovskiy on Facebook" className={socialLinkClasses}>
                <FacebookIcon />
              </a>
              <a href={YELP_URL} target="_blank" rel="noopener noreferrer" aria-label="George Khazanovskiy on Yelp">
                <YelpIcon />
              </a>
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" aria-label="George Khazanovskiy on Google">
                <GoogleIcon />
              </a>
            </div>
            <div className="pt-4">
              <Link to="/russian-speaking-realtor-temecula/" className="inline-flex items-center gap-2 font-sans text-[13px] text-white font-bold hover:text-[#C8920A] transition-colors bg-white/10 px-4 py-2 rounded-md border border-white/20 hover:border-[#C8920A]/50">
                <span>🇷🇺</span> Русскоязычный риэлтор — Russian &amp; Ukrainian speaking
              </Link>
            </div>
          </div>

          {/* Column 2: Buy a Home */}
          <div>
            <h3 className={headingClasses}>Buy a Home</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <a
                href={APEX_SEARCH_FOOTER_URL}
                target="_blank"
                rel="noopener"
                onClick={() => trackSearchHomesClick('footer')}
                className={linkClasses}
              >
                Search Homes ↗
              </a>
              <Link to="/homes-for-sale-temecula/" className={linkClasses}>Listing Alerts</Link>
              <Link to="/homes-for-sale-temecula/" className={linkClasses}>First-Time Buyer Guide</Link>
            </div>
          </div>

          {/* Column 3: Sell Your Home */}
          <div>
            <h3 className={headingClasses}>Sell Your Home</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <Link to="/sell-my-house/" className={linkClasses}>Free Home Valuation</Link>
              <Link to="/sell-my-house/" className={linkClasses}>What's My Home Worth?</Link>
              <Link to="/sell-my-house/" className={linkClasses}>How We Market Homes</Link>
              <Link to="/sell-my-house/" className={linkClasses}>Seller's Process</Link>
              <Link to="/sell-my-house/" className={linkClasses}>Free Seller's Guide</Link>
            </div>
          </div>

          {/* Column 4: Important Links */}
          <div>
            <h3 className={headingClasses}>Important Links</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <Link to="/homes-for-sale-temecula/" className={linkClasses}>Browse Temecula Homes</Link>
              <Link to="/sell-my-house/" className={linkClasses}>Free Home Valuation</Link>
              <Link to="/about-george/" className={linkClasses}>About George</Link>
              <Link to="/contact/" className={linkClasses}>Contact</Link>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#C8920A]">
        <div className="max-w-7xl mx-auto py-[20px] px-[24px] flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="font-sans text-[12px] text-gray-300">
            © 2026 Temecula Valley Homes · George Khazanovskiy
          </p>
          <div className="font-sans text-[12px] text-gray-300 flex flex-wrap items-center justify-center gap-2">
            <EHOIcon className="text-gray-300" />
            <span>Equal Housing Opportunity</span>
            <span>|</span>
            <span>DRE #02034120</span>
            <span>|</span>
            <span>Allison James Estates &amp; Homes</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
