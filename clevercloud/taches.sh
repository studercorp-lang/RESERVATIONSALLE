#!/bin/bash -l
# Tâches automatiques de l'application (toutes les heures, voir clevercloud/cron.json) :
# rappels, expiration des demandes, durées de conservation RGPD.
# « bash -l » + APP_HOME : nécessaire pour accéder aux variables d'environnement (DATABASE_URL…).
cd "${APP_HOME}" || exit 1
npm run jobs
