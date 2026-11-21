import { Link } from "react-router-dom";

function PrivacyPage() {
  return (
    <section className="page-narrow">
      <Link className="back-link" to="/">← Home</Link>
      <h1 className="page-title">Privacy</h1>
      <p className="section-sub">
        This is a plain-language summary of how the VJTI Placements portal handles your information.
      </p>
      <div className="guidelines-card">
        <h2>What we store</h2>
        <ul>
          <li><strong>Account details:</strong> your name, college email address, branch, and graduation year (if you provide them).</li>
          <li><strong>Experiences:</strong> interview write-ups you submit, including company, role, year, tags, and visibility choice.</li>
          <li><strong>Portal activity:</strong> bookmarks, notifications, and application tracking data you create while using the portal.</li>
        </ul>
        <h2>Who can see what</h2>
        <ul>
          <li><strong>Students and visitors:</strong> can see approved public experiences. If you choose anonymous posting, your name is hidden from students and shown as “Anonymous senior”.</li>
          <li><strong>Placement staff:</strong> can see the real author identity for moderation and accountability, even for anonymous posts.</li>
          <li><strong>Admins:</strong> can manage accounts, roles, and audit records needed to operate the portal.</li>
        </ul>
        <h2>Deletion requests</h2>
        <ul>
          <li>You can delete your account from the <Link to="/account">Account</Link> page while signed in.</li>
          <li>Deleting your account removes your account, bookmarks, and notifications. Your published experiences are kept for juniors but anonymized and no longer attributed to you.</li>
          <li>If you need help, contact the placement office or portal administrators through your college channels.</li>
        </ul>
      </div>
    </section>
  );
}

export default PrivacyPage;
