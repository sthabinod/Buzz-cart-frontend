export default function Footer() {
    return (
      <footer>
        <div className="footer-inner">
          <span>© {new Date().getFullYear()} BuzCart · All rights reserved.</span>
          {/* <a href="/terms">Terms</a>
          <span>•</span>
          <a href="/privacy">Privacy</a> */}
        </div>
      </footer>
    );
  }