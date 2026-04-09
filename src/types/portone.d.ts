declare namespace PortOne {
  interface IssueBillingKeyRequest {
    storeId: string;
    channelKey: string;
    billingKeyMethod: "EASY_PAY" | "CARD";
    issueName: string;
    redirectUrl?: string;
    windowType?: {
      pc?: "IFRAME" | "POPUP" | "REDIRECTION" | "UI";
      mobile?: "IFRAME" | "POPUP" | "REDIRECTION" | "UI";
    };
    customer?: {
      customerId?: string;
      email?: string;
      fullName?: string;
      phoneNumber?: string;
    };
  }

  interface IssueBillingKeyResponse {
    code?: string;
    message?: string;
    billingKey?: string;
  }

  function requestIssueBillingKey(
    request: IssueBillingKeyRequest
  ): Promise<IssueBillingKeyResponse>;
}

interface Window {
  PortOne: typeof PortOne;
}
