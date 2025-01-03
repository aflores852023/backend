import ENVIROMENT from "../config/enviroment.config.js"
import User from "../models/user.model.js"
import ResponseBuilder from "../utils/builders/responseBuilder.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sendEmail } from "../utils/mail.util.js"
import UserRepository from "../repositories/user.repository.js"




export const registerUserController = async (req, res) => { //POST regsitrar usuario
    try {
        const { name, email, password } = req.body
        /* Hacer validacion */

        if (!name) {
            const response = new ResponseBuilder()
                .setOk(false)
                .setStatus(400)
                .setMessage('Bad request')
                .setPayload(
                    {
                        detail: 'El nombre no es valido'
                    }
                )
                .build()
            return res.status(400).json(response)
        }

        if (!password) {
            const response = new ResponseBuilder()
                .setOk(false)
                .setStatus(400)
                .setMessage('Bad request')
                .setPayload(
                    {
                        detail: 'El password no es valido'
                    }
                )
                .build()
            return res.status(400).json(response)
        }

        if (!email) {
            const response = new ResponseBuilder()
                .setOk(false)
                .setStatus(400)
                .setMessage('Bad request')
                .setPayload(
                    {
                        detail: 'El email no es valido'
                    }
                )
                .build()
            return res.status(400).json(response)
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        console.log('la password hash es ', hashedPassword,
            console.log('el email es ', email)

        )
        const verificationToken = jwt.sign(
            {
                email: email
            }, ENVIROMENT.JWT_SECRET, {
            expiresIn: '1d'
        })
        if (!ENVIROMENT.JWT_SECRET) {
            throw new Error('JWT_SECRET no está configurado en el entorno');
        }
        const url_verification = `${ENVIROMENT.URL_FRONT}/verify/?token=${verificationToken}?x-api-key=${ENVIROMENT.API_KEY_INTERN}`
        await sendEmail({
            from: ENVIROMENT.GMAIL_USER,
            to: email,
            subject: 'Valida tu correo electronico',
            html: `
            <h1>Verificacion de correo electronico</h1>
            <p>Da click en el boton de abajo para verificar</p>
            <a 
                style='background-color: 'black'; color: 'white'; padding: 5px; border-radius: 5px;'
                href="${url_verification}"
            >Click aqui</a>
            `
        })
        console.log('la url de validacion es ', url_verification)
        console.log('Correo que se intentará enviar:', {
            to: email,
            from: ENVIROMENT.GMAIL_USER,
            subject: 'Valida tu correo electrónico',
        });
        console.log('JWT_SECRET:', ENVIROMENT.JWT_SECRET); // Verifica que la clave secreta esté cargada
        console.log('Datos recibidos:', req.body);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            verificationToken: verificationToken,
            emailVerified: false
        })

        //Metodo save nos permite guardar el objeto en la DB
        await newUser.save()

        const response = new ResponseBuilder()
            .setOk(true)
            .setStatus(200)
            .setMessage('Created')
            .setPayload({})
            .build()
        return res.status(201).json(response)
    }
    catch (error) {
        if (error.code === 11000) {
            res.sendStatus(400)
        }
        console.error('Error al registrar usuario:', error)
        console.log("JWT_SECRET:", process.env.JWT_SECRET); // Verifica que la clave secreta esté cargada
        console.log("PORT:", process.env.PORT); // Verifica que el puerto esté cargado
        console.log("API_KEY_INTERN:", process.env.API_KEY_INTERN); // Verifica que la API Key esté cargada

        const response = new ResponseBuilder()
            .setOk(false)
            .setStatus(500)
            .setMessage('Internal server error')
            .setPayload(
                {
                    detail: error.message,

                }
            )
            .build()
        return res.status(500).json(response)
    }

}


export const verifyMailValidationTokenController = async (req, res) => { //verificar email por token 
    try {
        const { verification_token } = req.params
        console.log('el token es ', verification_token)

        if (!verification_token) {
            const response = new ResponseBuilder().setOk(false)
                .setStatus(400)
                .setPayload({
                    'detail': 'Falta enviar token'
                })
                .build()
            return res.json(response)
        }
        //Verificamos la firma del token, debe ser la misma que mi clave secreta, eso asegura que este token sea emitido por mi servidor
        //Si fallara la lectura/verificacion/expiracion hara un throw
        //La constante decoded tiene el payload de mi token
        const decoded = jwt.verify(verification_token, ENVIROMENT.JWT_SECRET)
        //console.log('el decoded es ', decoded)  

        //Busco al usuario en mi DB por email
        const user = await User.findOne({ email: decoded.email })
        if (!user) {
            //Logica de error de not found
        }
        if (user.emailVerified) {
            //Logica de email ya verificado
        }
        //En caso de pasar la validaciones
        user.emailVerified = true
        //user.verificationToken = undefined

        await user.save()
        const response = new ResponseBuilder()
            .setOk(true)
            .setMessage('Email verificado con exito')
            .setStatus(200)
            .setPayload({
                message: "Usuario validado"
            })
            .build()
        res.json(response)
    }
    catch (error) {
        console.error(error)
    }
}


export const loginController = async (req, res) => { //POST login usuario
    console.log('Llegó al controlador de login. Body recibido:', req.body);

    try {
        const { email, password } = req.body
        console.log('el email es ', email)
        console.log('la password es ', password)
        console.log('Buscando usuario con email:', email);
        const user = await User.findOne({ email });
        console.log('Usuario encontrado:', user);
        if (!user) {
            const response = new ResponseBuilder()
                .setOk(false)
                .setStatus(404)
                .setMessage('Usuario no encontrado')
                .setPayload({
                    detail: 'El email no esta registrado'
                })
                .build()
            return res.json(response)
        }
        if (!user.emailVerified) {
            const response = new ResponseBuilder()
                .setOk(false)
                .setStatus(403)//Contenido PROHIBIDO para usuarios que no tengan su email verificado
                .setMessage('Email no verificado')
                .setPayload(
                    {
                        detail: 'Por favor, verifica tu correo electronico antes de iniciar sesion'
                    }
                )
                .build()
            return res.json(response)
        }

        const isValidPassword = await bcrypt.compare(password, user.password)

        console.log('el isValidPassword es ', isValidPassword

        )
        if (!isValidPassword) {
            const response = new ResponseBuilder() //Credenciales incorrectas
                .setOk(false)
                .setStatus(401)
                .setMessage('Credenciales incorrectas')
                .setPayload({
                    detail: 'Contraseña incorrecta'
                })
                .build()
            return res.json(response)
        }
        const token = jwt.sign( //Generamos el token para saber el usuario y despues validar que roles tiene acceso
            {
                email: user.email,
                id: user._id,
                role: user.role
            },
            ENVIROMENT.JWT_SECRET,
            { expiresIn: '1d' }
        )
        const response = new ResponseBuilder() //Credenciales correctas seteo el mensaje y el token
            .setOk(true)
            .setStatus(200)
            .setMessage('Logueado')
            .setPayload({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            })
            .build()
        res.json(response)
    }
    catch (error) {
        const response = new ResponseBuilder()
            .setOk(false)
            .setStatus(500)
            .setMessage('Internal server error')
            .setPayload({
                detail: error.message
            })
            .build()
        res.json(response)
    }

}


export const forgotPasswordController = async (req, res) => { //POST forgot password
    try {
        const { email } = req.body
        //Validamos que llegue el email
        console.log(email)
        const user = await UserRepository.obtenerPorEmail(email)
        if (!user) {
            //Logica de usuario no encontrado
        }
        const resetToken = jwt.sign({ email: user.email }, ENVIROMENT.JWT_SECRET, {
            expiresIn: '1h'
        })
        user.resetToken = resetToken;
        await UserRepository.guardarUsuario(user); // Asegúrate de que esto esté implementado
        const URL_FRONT = ENVIROMENT.URL_FRONT
        const resetUrl = `${URL_FRONT}/reset-password/${resetToken}`
        sendEmail({
            from: ENVIROMENT.GMAIL_USER,
            to: user.email,
            subject: 'Restablecer contraseña',
            html: `
                <div>
                    <h1>Has solicitado restablecer tu contraseña</h1>
                    <p>Has click en el enlace de abajo para restablecer tu contraseña</p>
                    <a href='${resetUrl}'>Restablecer</a>
                </div>
            `
        })
        const response = new ResponseBuilder()
        response
            .setOk(true)
            .setStatus(200)
            .setMessage('Se envio el correo')
            .setPayload({
                detail: 'Se envio un correo electronico con las instrucciones para restablecer la contraseña.'
            })
            .build()
        return res.json(response)
    }
    catch (error) {
        //Manajer logica de error
    }
}


export const resetTokenController = async (req, res) => {
    const { reset_token } = req.params;
    const { password } = req.body;

    console.log('Reset Token recibido:', reset_token);
    console.log('Password recibido:', password);
    if (!reset_token || !password) {
        return res.status(400).json({ ok: false, message: 'Token o contraseña faltante.' });
    }

    try {
        // Busca al usuario por el token de restablecimiento
        const user = await User.findOne({ resetToken: reset_token });

        if (!user) {
            return res.status(404).json({ ok: false, message: 'Token no válido o expirado.' });
        }

        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(password, 10); // 10 es el saltRounds
        user.password = hashedPassword;
        user.resetToken = null; // Limpia el token una vez que se usa
        await UserRepository.guardarUsuario(user);

        res.json({ ok: true, message: 'Contraseña restablecida con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
};

