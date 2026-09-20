import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import cron from 'node-cron'
import nodemailer from 'nodemailer'

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }))
app.use(express.json())

const userSchema = new mongoose.Schema({ name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true }, password: { type: String, required: true }, emailVerified: { type: Boolean, default: false }, verificationTokenHash: String, verificationTokenExpires: Date }, { timestamps: true })
const entrySchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, date: { type: Date, required: true }, title: String, body: String, mood: String, starred: Boolean }, { timestamps: true })
const goalSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, title: String, detail: String, current: { type: Number, default: 0 }, target: { type: Number, default: 1 }, color: String }, { timestamps: true })
const blockSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, time: String, end: String, title: String, color: String, completed: { type: Boolean, default: false } }, { timestamps: true })
const User = mongoose.model('User', userSchema); const Entry = mongoose.model('Entry', entrySchema); const Goal = mongoose.model('Goal', goalSchema); const Block = mongoose.model('Block', blockSchema)
const tokenFor = user => jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'development-secret-change-me', { expiresIn: '7d' })
const mailer = process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASSWORD ? nodemailer.createTransport({ host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT || 465), secure: process.env.MAIL_SECURE !== 'false', auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD } }) : null
const sendMail = (to, subject, html) => { if (!mailer) throw new Error('Email service is not configured on the server'); return mailer.sendMail({ from: process.env.MAIL_FROM || process.env.MAIL_USER, to, subject, html }) }
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex')
const sendVerificationEmail = async user => { const token = crypto.randomBytes(32).toString('hex'); user.verificationTokenHash = hashToken(token); user.verificationTokenExpires = new Date(Date.now() + 86400000); await user.save(); const link = `${process.env.API_PUBLIC_URL || 'http://localhost:5000/api'}/auth/verify-email?token=${token}`; await sendMail(user.email, 'Verify your Dayline email', `<p>Hi ${user.name},</p><p><a href="${link}">Verify my Dayline email</a></p><p>This link expires in 24 hours.</p>`) }
const sendDueReminders = async () => { if (!mailer) return; const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); const entries = await Entry.find({ starred: true, date: { $gte: start, $lt: end } }).populate('user', 'name email'); for (const entry of entries) await sendMail(entry.user.email, `Dayline reminder: ${entry.title || 'important moment'}`, `<p>Hi ${entry.user.name},</p><h2>${entry.title || 'Important moment'}</h2><p>${entry.body || ''}</p>`) }
const auth = async (req, res, next) => { try { const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) return res.status(401).json({ message: 'Authentication required' }); const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-change-me'); req.user = await User.findById(decoded.id).select('-password'); if (!req.user) return res.status(401).json({ message: 'User not found' }); next() } catch { res.status(401).json({ message: 'Invalid or expired session' }) } }

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'dayline-api' }))
app.post('/api/auth/signup', async (req, res) => { try { const { name, email, password } = req.body; if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' }); const existing = await User.findOne({ email }); if (existing) { if (existing.emailVerified) return res.status(409).json({ message: 'An account with that email already exists' }); await sendVerificationEmail(existing); return res.json({ message: 'This account is not verified yet. A new verification email was sent.' }) } const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) }); await sendVerificationEmail(user); res.status(201).json({ message: 'Check your email to verify your account' }) } catch (error) { res.status(500).json({ message: error.message }) } })
app.get('/api/auth/verify-email', async (req, res) => { try { const user = await User.findOne({ verificationTokenHash: hashToken(req.query.token || ''), verificationTokenExpires: { $gt: new Date() } }); if (!user) return res.status(400).send('This verification link is invalid or expired.'); user.emailVerified = true; user.verificationTokenHash = undefined; user.verificationTokenExpires = undefined; await user.save(); res.redirect(`${process.env.CLIENT_URL}/login?verified=1`) } catch (error) { res.status(500).send(error.message) } })
app.post('/api/auth/resend-verification', async (req, res) => { const user = await User.findOne({ email: req.body.email }); if (user && !user.emailVerified) await sendVerificationEmail(user); res.json({ message: 'If that account exists, a verification email was sent' }) })
app.post('/api/auth/login', async (req, res) => { try { const user = await User.findOne({ email: req.body.email }); if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ message: 'Email or password is incorrect' }); if (!user.emailVerified) return res.status(403).json({ message: 'Please verify your email before signing in' }); res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email } }) } catch (error) { res.status(500).json({ message: error.message }) } })
app.get('/api/me', auth, (req, res) => res.json(req.user))
app.get('/api/entries', auth, async (req, res) => res.json(await Entry.find({ user: req.user._id }).sort({ date: -1 })))
app.post('/api/entries', auth, async (req, res) => res.status(201).json(await Entry.create({ ...req.body, user: req.user._id })))
app.patch('/api/entries/:id', auth, async (req, res) => res.json(await Entry.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true })))
app.delete('/api/entries/:id', auth, async (req, res) => { await Entry.deleteOne({ _id: req.params.id, user: req.user._id }); res.status(204).end() })
app.get('/api/goals', auth, async (req, res) => res.json(await Goal.find({ user: req.user._id }).sort({ createdAt: -1 })))
app.post('/api/goals', auth, async (req, res) => res.status(201).json(await Goal.create({ ...req.body, user: req.user._id })))
app.patch('/api/goals/:id', auth, async (req, res) => res.json(await Goal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true })))
app.delete('/api/goals/:id', auth, async (req, res) => { await Goal.deleteOne({ _id: req.params.id, user: req.user._id }); res.status(204).end() })
app.get('/api/blocks', auth, async (req, res) => res.json(await Block.find({ user: req.user._id }).sort({ time: 1 })))
app.post('/api/blocks', auth, async (req, res) => res.status(201).json(await Block.create({ ...req.body, user: req.user._id })))
app.patch('/api/blocks/:id', auth, async (req, res) => res.json(await Block.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true })))
app.delete('/api/blocks/:id', auth, async (req, res) => { await Block.deleteOne({ _id: req.params.id, user: req.user._id }); res.status(204).end() })

const port = process.env.PORT || 5000
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dayline').then(() => { app.listen(port, () => console.log(`Dayline API listening on ${port}`)); if (mailer) cron.schedule(process.env.REMINDER_CRON || '0 8 * * *', () => sendDueReminders().catch(error => console.error('Reminder email failed:', error.message)), { timezone: process.env.TZ || 'UTC' }) }).catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1) })
