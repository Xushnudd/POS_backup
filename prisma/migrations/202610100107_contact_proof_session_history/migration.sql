-- Contact ownership is global to the account, not to one organization.
-- Retain the source session identity as history when an organization is removed.
-- Insert guard still validates session/user scope; consumption checks a live session.
ALTER TABLE "AuthChallenge" DROP CONSTRAINT "AuthChallenge_sessionId_fkey";
