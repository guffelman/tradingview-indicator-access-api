const os = require("os");
const { encode_multipart_formdata } = require("./helper");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config();

const urls = {
  tvcoins: "https://www.tradingview.com/tvcoins/details/",
  username_hint: "https://www.tradingview.com/username_hint/",
  list_users: "https://www.tradingview.com/pine_perm/list_users/",
  modify_access:
    "https://www.tradingview.com/pine_perm/modify_user_expiration/",
  add_access: "https://www.tradingview.com/pine_perm/add/",
  remove_access: "https://www.tradingview.com/pine_perm/remove/",
  signin: "https://www.tradingview.com/accounts/signin/",
};

class TradingView {
  constructor() {
    this.sessionid = ""; // Initialize sessionid to an empty string
    this.sessignidsign = "";
    this.headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": undefined,
      cookie: `sessionid=${this.sessionid}`,
      "X-XSRF-TOKEN": "", // Initialize X-XSRF-TOKEN to an empty string
      "User-Agent": "axios/1.6.4",
      "Accept-Encoding": "gzip, compress, deflate, br",
    };

    this.checkSessionAndLogin();
  }

  async checkSessionAndLogin() {
    try {
      const response = await axios.get(urls["tvcoins"], {
        headers: this.headers,
      });
      console.log("Debug >> Response Status:", response.status);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log("Session ID is invalid. Logging in...");
        await this.login();
      } else {
        console.log("Session ID is valid.");
      }
    }
  }

  async login() {
    try {
      const username = process.env.tvusername;
      const password = process.env.tvpassword;

      const payload = { username, password, remember: "on" };
      const body = querystring.stringify(payload);
      const contentType = "application/x-www-form-urlencoded";
      const userAgent = `Mozilla/5.0 (${os.platform()}; ${os.version()}; ${os.release()})`;

      const login_headers = {
        origin: "https://www.tradingview.com",
        "User-Agent": userAgent,
        "Content-Type": contentType,
        referer: "https://www.tradingview.com",
      };

      const loginResponse = await axios.post(urls["signin"], body, {
        headers: login_headers,
      });
      console.log("Debug >> Login Response", loginResponse);
      const cookies =
        loginResponse.headers && loginResponse.headers["Set-Cookie"];
      if (cookies) {
        console.log("Login Response:", loginResponse.data);
        this.sessionid = cookies
          .find((cookie) => cookie.startsWith("sessionid="))
          .split("=")[1]
          .split(";")[0];
        console.log(this.sessionid);
        const csrfToken = cookies
          .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
          .split("=")[1]
          .split(";")[0];

        // Set this.headers here
        this.headers = {
          Accept: "application/json, text/plain, */*",
          "Content-Type": undefined,
          cookie: `sessionid=${this.sessionid}`,
          "X-XSRF-TOKEN": csrfToken,
          "User-Agent": "axios/1.6.4",
          "Accept-Encoding": "gzip, compress, deflate, br",
        };

        console.log("Login successful. New Session ID:", this.sessionid);
        console.log("CSRF Token:", csrfToken);

        // Trigger subsequent action or check the session again
        await this.checkSessionAndLogin();
      } else {
        console.error("[X] Cookies not found in login response.");
      }
    } catch (error) {
      console.error("[X] Exception Occurred during login:", error);
    }
  }

  validateUsername(username) {
    return axios
      .get(urls["username_hint"] + `?s=${username}`)
      .then((response) => {
        const usersList = response.data;
        let validUser = false;
        let verifiedUserName = "";
        for (const user of usersList) {
          if (user.username.toLowerCase() === username.toLowerCase()) {
            validUser = true;
            verifiedUserName = user.username;
          }
        }
        return { validuser: validUser, verifiedUserName: verifiedUserName };
      })
      .catch((error) => {
        console.error("[X] Exception Occurred:", error);
        return { errorMessage: "Unknown Exception Occurred" };
      });
  }

  getAccessDetails(username, pine_id) {
    const user_payload = { pine_id, username };

    const user_headers = {
      origin: "https://www.tradingview.com",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `sessionid=${this.sessionid}`,
    };

    return axios
      .post(urls["list_users"] + "?limit=10&order_by=-created", user_payload, {
        headers: user_headers,
      })
      .then((usersResponse) => {
        const userResponseJson = usersResponse.data;
        const users = userResponseJson.results;

        const access_details = user_payload;
        let hasAccess = false;
        let noExpiration = false;
        let expiration = new Date().toISOString();
        for (const user of users) {
          if (user.username.toLowerCase() === username.toLowerCase()) {
            hasAccess = true;
            const strExpiration = user.expiration;
            if (strExpiration !== null) {
              expiration = user.expiration;
            } else {
              noExpiration = true;
            }
          }
        }

        access_details.hasAccess = hasAccess;
        access_details.noExpiration = noExpiration;
        access_details.currentExpiration = expiration;
        return access_details;
      })
      .catch((error) => {
        console.error("[X] Exception Occurred:", error);
        return { errorMessage: "Unknown Exception Occurred" };
      });
  }

  addAccess(access_details, extension_type, extension_length) {
    const noExpiration = access_details.noExpiration;
    access_details.expiration = access_details.currentExpiration;
    access_details.status = "Not Applied";

    if (!noExpiration) {
      const payload = {
        pine_id: access_details.pine_id,
        username_recip: access_details.username,
      };

      if (extension_type !== "L") {
        const expiration = helper.getAccessExtension(
          access_details.currentExpiration,
          extension_type,
          extension_length
        );
        payload.expiration = expiration;
        access_details.expiration = expiration;
      } else {
        access_details.noExpiration = true;
      }

      const endpoint_type = access_details.hasAccess
        ? "modify_access"
        : "add_access";

      const body = querystring.stringify(payload);

      const headers = {
        origin: "https://www.tradingview.com",
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: `sessionid=${this.sessionid}`,
      };

      return axios
        .post(urls[endpoint_type], body, { headers })
        .then((add_access_response) => {
          access_details.status =
            add_access_response.status === 200 ||
            add_access_response.status === 201
              ? "Success"
              : "Failure";
          return access_details;
        })
        .catch((error) => {
          console.error("[X] Exception Occurred:", error);
          return { errorMessage: "Unknown Exception Occurred" };
        });
    } else {
      return Promise.resolve(access_details);
    }
  }

  removeAccess(access_details) {
    const payload = {
      pine_id: access_details.pine_id,
      username_recip: access_details.username,
    };
    const body = querystring.stringify(payload);

    const headers = {
      origin: "https://www.tradingview.com",
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: `sessionid=${this.sessionid}`,
    };

    return axios
      .post(urls["remove_access"], body, { headers })
      .then((remove_access_response) => {
        access_details.status =
          remove_access_response.status === 200 ? "Success" : "Failure";
        return access_details;
      })
      .catch((error) => {
        console.error("[X] Exception Occurred:", error);
        return { errorMessage: "Unknown Exception Occurred" };
      });
  }

}

module.exports = TradingView;