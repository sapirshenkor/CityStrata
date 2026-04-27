import { z } from 'zod'

/** Matches current login UI: email + password, min 8 characters (as HTML minLength on password). */
export const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'שדה חובה').email('כתובת דוא"ל לא תקינה'),
  password: z.string().min(8, 'לפחות 8 תווים'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

/**
 * Same fields and semantics as the previous SignupPage submit:
 * - required first/last/email/password (password min 8)
 * - optional phone and department, mapping to `phone_number: ''` and `department: null` when empty
 */
export const signupFormSchema = z.object({
  first_name: z.string().trim().min(1, 'שדה חובה'),
  last_name: z.string().trim().min(1, 'שדה חובה'),
  email: z.string().trim().min(1, 'שדה חובה').email('כתובת דוא"ל לא תקינה'),
  phone: z.string(),
  department: z.string(),
  password: z.string().min(8, 'לפחות 8 תווים'),
})

export type SignupFormValues = z.infer<typeof signupFormSchema>

export function toSignupPayload(values: SignupFormValues) {
  return {
    email: values.email,
    password: values.password,
    first_name: values.first_name,
    last_name: values.last_name,
    phone_number: values.phone.trim() || '',
    department: values.department.trim() || null,
  }
}
