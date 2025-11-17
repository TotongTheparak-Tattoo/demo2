export default function AccessDenied() {
  return (
    <>
      <div className="wrapper"style={{ overflowX: "hidden", fontSize: "14px" }}>
        <div className="content-wrapper" >
          <div className="container-fluid">
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: "50px" }}>
                Access - Denied
              </h3>
            </div>
            <div className="card-body" style={{ fontSize: "25px" }}>
              <p>Your role doesn't have permission. Please contact Admin.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};


