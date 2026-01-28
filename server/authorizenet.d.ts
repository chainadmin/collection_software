declare module 'authorizenet' {
  const authorizenet: {
    APIContracts: typeof APIContracts;
    APIControllers: typeof APIControllers;
    Constants: typeof Constants;
  };
  export default authorizenet;

  namespace APIContracts {
    class MerchantAuthenticationType {
      setName(name: string): void;
      setTransactionKey(key: string): void;
    }
    
    class CreditCardType {
      setCardNumber(number: string): void;
      setExpirationDate(date: string): void;
      setCardCode(code: string): void;
    }
    
    class BankAccountType {
      setAccountType(type: any): void;
      setRoutingNumber(number: string): void;
      setAccountNumber(number: string): void;
      setNameOnAccount(name: string): void;
      setEcheckType(type: any): void;
    }
    
    class PaymentType {
      setCreditCard(card: CreditCardType): void;
      setBankAccount(account: BankAccountType): void;
      setOpaqueData(data: OpaqueDataType): void;
    }
    
    class OpaqueDataType {
      setDataDescriptor(descriptor: string): void;
      setDataValue(value: string): void;
    }
    
    class OrderType {
      setInvoiceNumber(number: string): void;
      setDescription(description: string): void;
    }
    
    class CustomerDataType {
      setEmail(email: string): void;
    }
    
    class TransactionRequestType {
      setTransactionType(type: any): void;
      setPayment(payment: PaymentType): void;
      setAmount(amount: number): void;
      setOrder(order: OrderType): void;
      setCustomer(customer: CustomerDataType): void;
      setRefTransId(id: string): void;
    }
    
    class CreateTransactionRequest {
      setMerchantAuthentication(auth: MerchantAuthenticationType): void;
      setTransactionRequest(request: TransactionRequestType): void;
      getJSON(): any;
    }
    
    class CreateTransactionResponse {
      constructor(response: any);
      getMessages(): any;
      getTransactionResponse(): any;
    }
    
    const TransactionTypeEnum: {
      AUTHCAPTURETRANSACTION: string;
      AUTHONLYTRANSACTION: string;
      CAPTUREONLYTRANSACTION: string;
      REFUNDTRANSACTION: string;
      VOIDTRANSACTION: string;
    };
    
    const MessageTypeEnum: {
      OK: string;
      ERROR: string;
    };
    
    const BankAccountTypeEnum: {
      CHECKING: string;
      SAVINGS: string;
    };
    
    const EcheckTypeEnum: {
      WEB: string;
      PPD: string;
      CCD: string;
    };
  }
  
  export namespace APIControllers {
    class CreateTransactionController {
      constructor(request: any);
      setEnvironment(env: string): void;
      execute(callback: () => void): void;
      getResponse(): any;
    }
  }
  
  export namespace Constants {
    const endpoint: {
      production: string;
      sandbox: string;
    };
  }
}
