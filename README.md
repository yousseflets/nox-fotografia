# NOX Fotografia

Site institucional + área administrativa + área do cliente, com Angular 19 e Firebase.

## Stack

- **Angular 19** — frontend
- **AngularFire** — Auth, Firestore e Storage
- **Firebase Authentication** — login do fotógrafo (admin) e dos clientes
- **Cloud Firestore** — usuários, álbuns e metadados das fotos
- **Firebase Storage** — arquivos das fotos
- **Vercel** — hospedagem (SPA com rewrite)

## Estrutura de rotas

| Rota | Acesso |
|------|--------|
| `/` | Site público |
| `/login` | Login |
| `/cadastro` | Cadastro de cliente |
| `/admin` | Painel do fotógrafo (`role: admin`) |
| `/cliente` | Área do cliente (`role: client`) |

## Coleções Firestore

```json
// users/{uid}
{ "uid": "...", "name": "Maria", "email": "maria@email.com", "role": "client" }

// albums/{id}
{ "title": "Casamento João e Ana", "clientId": "abc123", "clientName": "Maria", "createdAt": "..." }

// photos/{id}
{ "albumId": "album001", "url": "https://...", "filename": "foto1.jpg", "storagePath": "clients/.../foto1.jpg", "createdAt": "..." }
```

Fotos no Storage: `clients/{clientId}/albums/{albumId}/{arquivo}`

## Setup Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative **Authentication** (e-mail/senha), **Firestore** e **Storage**.
3. Copie a config do app web para:
   - `src/environments/environment.development.ts`
   - `src/environments/environment.ts`
4. Publique as regras e índices:

```bash
npm i -g firebase-tools
firebase login
firebase use <seu-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Criar o primeiro admin

1. Crie um usuário em Authentication (e-mail/senha).
2. No Firestore, crie o documento `users/{uid}`:

```json
{
  "uid": "UID_DO_AUTH",
  "name": "NOX Admin",
  "email": "seu@email.com",
  "role": "admin",
  "createdAt": "2026-07-26T00:00:00.000Z"
}
```

## Desenvolvimento

```bash
npm install
npm start
```

App em `http://localhost:4200`.

## Build / Vercel

```bash
npm run build
```

Na Vercel, use o preset Angular (ou build command `npm run build` e output `dist/nox-fotografia/browser`). O `vercel.json` já faz rewrite para SPA.

## Fluxo

1. **Admin** faz login → cadastra clientes → cria álbum → faz upload das fotos.
2. **Cliente** se cadastra (ou é cadastrado pelo admin) → vê só os próprios álbuns → baixa fotos (individual ou ZIP).

As regras em `firestore.rules` e `storage.rules` impedem que um cliente leia álbuns/fotos de outro.
