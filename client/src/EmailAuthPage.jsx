import React, { useState } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')}/auth`

export default function EmailAuthPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const verified = searchParams.get('verified') === '1'
  const submit = async event => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API}/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Something went wrong')
      if (mode === 'signup') { setMessage(data.message); setMode('login'); return }
      localStorage.setItem('dayline_token', data.token)
      localStorage.setItem('dayline_user', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (submitError) { setError(submitError.message) }
  }
  return <div className="auth-page"><div className="auth-art"><div className="auth-brand"><span className="brand-mark">✦</span> dayline</div><div className="art-copy"><p className="eyebrow">A QUIET PLACE TO BEGIN</p><h1>Make room<br /><em>for what matters.</em></h1><p>Plan your days, hold onto the good moments, and keep moving toward the life you are building.</p></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-note"><Star size={14} fill="currentColor" /> Save the little things</div></div><div className="auth-form-wrap"><div className="auth-form"><p className="eyebrow">WELCOME TO DAYLINE</p><h2>{mode === 'login' ? 'Good to see you.' : 'Start your dayline.'}</h2><p className="auth-sub">{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create a space for the life you want to live.'}</p>{verified && <p className="save-status success">Email verified. You can sign in now.</p>}{message && <p className="save-status success">{message}</p>}<form onSubmit={submit}>{mode === 'signup' && <label>Your name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ari Johnson" /></label>}<label>Email address<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label><label>Password<input required minLength="6" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="••••••••" /></label>{error && <p className="form-error">{error}</p>}<button className="button dark auth-button">{mode === 'login' ? 'Sign in' : 'Create my space'} <ChevronRight size={17} /></button></form><p className="auth-switch">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'Create an account' : 'Sign in instead'}</button></p></div></div></div>
}
