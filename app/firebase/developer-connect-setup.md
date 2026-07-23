# Developer Connect: Future Project Setup

This is a future-project setup requirement, not a blocker or live change for the existing LaundryOps project.

Starting September 21, 2026, enabling Developer Connect will no longer automatically enable the Secret Manager API. Before creating a Developer Connect Git repository connection in a new Google Cloud or Firebase project:

1. Select the exact new project in Google Cloud Console.
2. Open **APIs & Services > Library**.
3. Find **Secret Manager API** (`secretmanager.googleapis.com`).
4. Enable it before configuring the Developer Connect repository connection.
5. Confirm the API is enabled for the same project ID used by Developer Connect.

For scripted future-project setup, explicitly enable `secretmanager.googleapis.com` before or alongside `developerconnect.googleapis.com`. Do not assume Developer Connect will enable Secret Manager automatically after September 21, 2026.

Existing projects that already have the required APIs enabled do not need a change solely because of this notice. LaundryOps does not require a live API change for this cleanup item.
