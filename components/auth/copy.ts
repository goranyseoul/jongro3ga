import type { Locale } from "@/lib/domain/common";

// Auth copy owned by track AUTH (messages/ belongs to the customer track). Shared by the landing
// auth dialog, /[locale]/signup and /[locale]/login.

export type AuthUiCopy = {
  password: string;
  passwordHint: string;
  email: string;
  emailError: string;
  signupSubmit: string;
  loginTitle: string;
  loginLead: string;
  loginSubmit: string;
  rememberMe: string;
  googleLogin: string;
  googleSignup: string;
  noAccount: string;
  signupLink: string;
  haveAccount: string;
  loginLink: string;
  pending: string;
  demoNote: string;
  denied: string;
  errors: {
    invalidCredentials: string;
    emailTaken: string;
    passwordTooShort: string;
    invalidEmail: string;
    tooMany: string;
    unknown: string;
  };
};

export const AUTH_COPY: Record<Locale, AuthUiCopy> = {
  ja: {
    password: "パスワード",
    passwordHint: "8文字以上",
    email: "メールアドレス",
    emailError: "メールアドレスの形式を確認してください。",
    signupSubmit: "登録して始める",
    loginTitle: "ログイン",
    loginLead: "登録したメールアドレスとパスワードでログインします。",
    loginSubmit: "ログイン",
    rememberMe: "ログイン状態を保持",
    googleLogin: "Googleでログイン",
    googleSignup: "Googleで登録",
    noAccount: "アカウントをお持ちでないですか？",
    signupLink: "会員登録",
    haveAccount: "すでにアカウントをお持ちですか？",
    loginLink: "ログイン",
    pending: "処理中",
    demoNote: "デモアカウントはパスワードなしですぐにログインします。",
    denied: "このページを開く権限がありません。別のアカウントでログインしてください。",
    errors: {
      invalidCredentials: "メールアドレスまたはパスワードが正しくありません。",
      emailTaken: "このメールアドレスはすでに登録されています。ログインしてください。",
      passwordTooShort: "パスワードは8文字以上にしてください。",
      invalidEmail: "メールアドレスの形式を確認してください。",
      tooMany: "試行回数が多すぎます。少し待ってからもう一度お試しください。",
      unknown: "うまくいきませんでした。もう一度お試しください。",
    },
  },
  "zh-CN": {
    password: "密码",
    passwordHint: "至少8个字符",
    email: "邮箱",
    emailError: "请检查邮箱格式。",
    signupSubmit: "注册并开始",
    loginTitle: "登录",
    loginLead: "使用注册时的邮箱和密码登录。",
    loginSubmit: "登录",
    rememberMe: "保持登录",
    googleLogin: "使用 Google 登录",
    googleSignup: "使用 Google 注册",
    noAccount: "还没有账号？",
    signupLink: "注册",
    haveAccount: "已有账号？",
    loginLink: "登录",
    pending: "处理中",
    demoNote: "演示账号无需密码，直接登录。",
    denied: "你没有打开此页面的权限，请使用其他账号登录。",
    errors: {
      invalidCredentials: "邮箱或密码不正确。",
      emailTaken: "该邮箱已注册，请直接登录。",
      passwordTooShort: "密码至少需要8个字符。",
      invalidEmail: "请检查邮箱格式。",
      tooMany: "尝试次数过多，请稍后再试。",
      unknown: "出了点问题，请再试一次。",
    },
  },
  en: {
    password: "Password",
    passwordHint: "At least 8 characters",
    email: "Email",
    emailError: "Check the email address format.",
    signupSubmit: "Sign up and start",
    loginTitle: "Log in",
    loginLead: "Log in with the email and password you signed up with.",
    loginSubmit: "Log in",
    rememberMe: "Remember me",
    googleLogin: "Log in with Google",
    googleSignup: "Sign up with Google",
    noAccount: "Don't have an account?",
    signupLink: "Sign up",
    haveAccount: "Already have an account?",
    loginLink: "Log in",
    pending: "Working",
    demoNote: "Demo accounts sign in right away, no password needed.",
    denied: "This account cannot open that page. Log in with a different account.",
    errors: {
      invalidCredentials: "The email or password is incorrect.",
      emailTaken: "This email is already registered. Log in instead.",
      passwordTooShort: "Use at least 8 characters for the password.",
      invalidEmail: "Check the email address format.",
      tooMany: "Too many attempts. Wait a moment and try again.",
      unknown: "Something went wrong. Please try again.",
    },
  },
  ko: {
    password: "비밀번호",
    passwordHint: "8자 이상",
    email: "이메일",
    emailError: "이메일 형식을 확인해 주세요.",
    signupSubmit: "가입하고 시작하기",
    loginTitle: "로그인",
    loginLead: "가입한 이메일과 비밀번호로 로그인합니다.",
    loginSubmit: "로그인",
    rememberMe: "로그인 상태 유지",
    googleLogin: "Google로 로그인",
    googleSignup: "Google로 가입",
    noAccount: "계정이 없으신가요?",
    signupLink: "회원가입",
    haveAccount: "이미 계정이 있으신가요?",
    loginLink: "로그인",
    pending: "처리 중",
    demoNote: "데모 계정은 비밀번호 없이 바로 로그인합니다.",
    denied: "이 계정으로는 열 수 없는 페이지예요. 다른 계정으로 로그인해 주세요.",
    errors: {
      invalidCredentials: "이메일 또는 비밀번호가 맞지 않아요.",
      emailTaken: "이미 가입된 이메일이에요. 로그인해 주세요.",
      passwordTooShort: "비밀번호는 8자 이상으로 해 주세요.",
      invalidEmail: "이메일 형식을 확인해 주세요.",
      tooMany: "시도가 너무 많아요. 잠시 후 다시 해 주세요.",
      unknown: "문제가 생겼어요. 다시 시도해 주세요.",
    },
  },
};

export function authCopy(locale: string): AuthUiCopy {
  return AUTH_COPY[(locale in AUTH_COPY ? locale : "en") as Locale];
}
