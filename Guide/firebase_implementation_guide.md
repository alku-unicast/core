
# UniCast — Firebase Setup Guide

This guide explains step-by-step how to configure UniCast with a new Firebase project. It is intended for users who want to create their own Firebase project instead of cloning the existing `unicast-8a705` project.

---

## Firebase's Role in the Project

UniCast uses Firebase Realtime Database only for **room list management**:

| Side | Responsibility |
|-------|----------------|
| Raspberry Pi | Writes `pi_status`, `pi_ip`, and `last_seen` to Firebase |
| UniCast Application (Rust) | Reads the room list from Firebase using anonymous authentication |
| User | Can read data but cannot write (protected by Firebase rules) |

**Critical Note:**  
The application (Rust backend) connects to Firebase using **anonymous authentication** — no API secret or service account is required for reading. Only the Pi side uses a service account.

```text
                    Firebase Realtime DB
                    ┌────────────────────┐
Pi ──(service key)──▶  /rooms/{id}       │
                    │    pi_ip: "10.x"   │
                    │    pi_status: "idle"│
                    │    last_seen: 1234  │
App ──(anon auth)──▶                     │
                    └────────────────────┘
````

---

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (example: `unicast-school`)
4. Google Analytics is optional and can be disabled
5. Click **"Create project"**

---

## 2. Create a Realtime Database

1. Open **"Realtime Database"** from the left menu
2. Click **"Create Database"**
3. Select a region:

   * `europe-west1`
   * or `us-central1`
4. Start in **Locked Mode** (we will configure rules later)

---

## 3. Configure Database Rules

Open the **"Rules"** tab and paste the following rules:

```json
{
  "rules": {
    "rooms": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.firebase.sign_in_provider == 'anonymous' == false"
    }
  }
}
```

### What These Rules Mean

* Anyone with **authenticated access** (including anonymous auth) can read the `rooms` collection
* Writing requires a **service account** (`firebase-key.json` on the Pi)
* Anonymous users (the application) can read but cannot write

Click **"Publish"** after updating the rules.

---

## 4. Enable Anonymous Authentication

To allow the Rust backend to read the database:

1. Open **"Authentication"**
2. Go to **"Sign-in method"**
3. Enable **"Anonymous"**
4. Save changes

---

## 5. Generate a Service Account Key (For Raspberry Pi)

1. Open Firebase Console
2. Click the project name → **"Project Settings"**
3. Open the **"Service Accounts"** tab
4. Click **"Generate New Private Key"**
5. Download the JSON file
6. Rename it to:

```text
firebase-key.json
```

> Warning:
> This file is confidential. Never commit it to Git or share it publicly.
> The project already blocks `firebase-key.json` through `.gitignore`.

---

## 6. Configure the Raspberry Pi

Copy `firebase-key.json` to the Pi:

```bash
# Copy from your computer to the Pi
scp firebase-key.json pi@<PI_IP>:~/unicast/src/receiver/firebase-key.json
```

Or create it directly on the Pi:

```bash
nano ~/unicast/src/receiver/firebase-key.json
# Paste the content and save with Ctrl+X
```

---

## 7. Update the Application Source Code

The Rust backend stores the Firebase URL directly in `firebase.rs`.

Update the following constants:

**`app/src-tauri/src/commands/firebase.rs`**

```rust
let api_key = "AIzaSy...";           
let db_url = "https://<project-id>-default-rtdb.europe-west1.firebasedatabase.app/rooms.json";
```

### Where to Find These Values

#### API Key

Firebase Console → Project Settings → General → Web API Key

#### Database URL

Realtime Database → Data tab → URL in the address bar

---

## 8. Start the Pi Agent

Install required Python dependencies:

```bash
pip3 install firebase-admin
```

Start the agent:

```bash
cd ~/unicast
python3 src/receiver/agent.py
```

If the Pi connects successfully, you should see:

```text
[agent] Firebase connection established.
[agent] IP: 10.x.x.x | Status: idle
[agent] PIN: 4821
[agent] Listening on UDP:5001...
```

---

## 9. Room List Structure

To manually add rooms:

Realtime Database → Data → Click `"+"`

```json
{
  "rooms": {
    "101": {
      "name": "101",
      "floor": "1",
      "pi_ip": "",
      "pi_status": "offline",
      "last_seen": 0
    },
    "B203": {
      "name": "B203",
      "floor": "2",
      "pi_ip": "",
      "pi_status": "offline",
      "last_seen": 0
    }
  }
}
```

| Field       | Description                    | Written By           |
| ----------- | ------------------------------ | -------------------- |
| `name`      | Displayed room name            | Manual (one-time)    |
| `floor`     | Floor number (string)          | Manual (one-time)    |
| `pi_ip`     | Raspberry Pi network IP        | Pi agent (automatic) |
| `pi_status` | `idle`, `streaming`, `offline` | Pi agent (automatic) |
| `last_seen` | Unix timestamp (seconds)       | Pi agent (every 30s) |

Once the Pi agent starts running, it automatically updates:

* `pi_ip`
* `pi_status`
* `last_seen`

---

## 10. Verification

If the setup is correct:

1. Pi is running → `pi_ip` and `last_seen` update in Firebase
2. UniCast application opens → Room list loads and Pi appears as `idle`
3. Clicking `"Connect"` opens the PIN entry screen

---

## Troubleshooting

### Application Cannot Load Room List

Check the following:

* Is Anonymous Authentication enabled?
* Do the database rules contain:

  ```json
  ".read": "auth != null"
  ```
* Are `api_key` and `db_url` correct in `firebase.rs`?

---

### Pi Cannot Write to Firebase

Check the following:

* Is `firebase-key.json` in:

  ```text
  src/receiver/firebase-key.json
  ```
* Is `firebase-admin` installed?

  ```bash
  pip3 install firebase-admin
  ```
* Does the `project_id` inside `firebase-key.json` match the Firebase project?

---

## Security Notes

* `firebase-key.json` must never be committed to the repository
* The Web API key (`api_key`) being visible in source code is normal
* Firebase rules restrict write access
* Reading requires anonymous authentication
* Direct requests to the database URL without an auth token return `401 Unauthorized`
